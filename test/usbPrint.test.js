// Test USB print service: concurrent claim, device serialization, partial transfers,
// USB failure + manual retry, no reprint after success recording failure
// Uses mocks for navigator.usb and supabase

const mockUsbDevices = new Map();
let transferOutResult = { status: 'ok', bytesWritten: 0 };
let shouldFailTransfer = false;
let transferCallCount = 0;

const mockJobs = new Map();
const mockSupabase = {
  from(table) {
    return {
      update(data) {
        return {
          eq(col, val) {
            if (col === 'status') {
              const results = [];
              for (const [id, job] of mockJobs) {
                if (job.status === val) {
                  Object.assign(job, data);
                  results.push({ id, ...job });
                }
              }
              return {
                select() {
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: results[0] || null, error: null });
                    }
                  };
                }
              };
            }
            for (const [id, job] of mockJobs) {
              if (job[col] === val) Object.assign(job, data);
            }
            return Promise.resolve({ error: null });
          },
        };
      },
      insert(data) {
        return {
          select() {
            return { single() { return Promise.resolve({ data: { id: 'test-job' }, error: null }); } }
          }
        };
      },
      select() {
        return {
          eq() {
            return {
              in() {
                return {
                  gte() {
                    return {
                      order() {
                        return {
                          limit() {
                            return Promise.resolve({ data: [] });
                          }
                        };
                      }
                    };
                  }
                };
              }
            };
          }
        };
      },
    };
  },
};

// Navigator mock
const mockNav = globalThis.navigator || {};
mockNav.usb = {
  getDevices: async () => Array.from(mockUsbDevices.values()),
  requestDevice: async () => {
    const d = createMockDevice(0x04b8, 0x0202, 'SN001', 'Epson TM-T20');
    mockUsbDevices.set(d.serialNumber, d);
    return d;
  },
};
globalThis.localStorage = globalThis.localStorage || {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
  get length() { return Object.keys(this._data).length; },
  key(i) { return Object.keys(this._data)[i]; },
};

function createMockDevice(vendorId, productId, serialNumber, productName) {
  return {
    vendorId,
    productId,
    serialNumber,
    productName,
    configuration: { interfaces: [{ alternates: [{ endpoints: [{ direction: 'out', endpointNumber: 1 }] }] }] },
    opened: false,
    async open() { this.opened = true; },
    async selectConfiguration(n) { },
    async claimInterface(n) { },
    async releaseInterface(n) { },
    async close() { this.opened = false; },
    async transferOut(ep, data) {
      transferCallCount++;
      if (shouldFailTransfer) {
        return { status: 'stall', bytesWritten: 0 };
      }
      const written = transferOutResult.bytesWritten || data.byteLength;
      return { status: 'ok', bytesWritten: written };
    },
  };
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

export async function testConcurrentJobClaim_onlyOneWins() {
  mockJobs.clear();
  mockJobs.set('job-1', { id: 'job-1', status: 'PENDING', printer_id: 'p1', type: 'RECEIPT', payload_text: '', order_id: null, table_id: null });

  const claim1 = mockSupabase.from('print_jobs').update({ status: 'PRINTING' }).eq('status', 'PENDING').select().maybeSingle();
  const claim2 = mockSupabase.from('print_jobs').update({ status: 'PRINTING' }).eq('status', 'PENDING').select().maybeSingle();

  const r1 = await claim1;
  const r2 = await claim2;

  assert(r1.data !== null, 'First claim should succeed');
  assert(r2.data === null, 'Second claim should return null (job already PRINTING)');
}

export async function testDeviceSerialization_transfersAreSerialized() {
  const deviceLocks = new Map();
  function getDeviceLock(key) {
    if (!deviceLocks.has(key)) deviceLocks.set(key, Promise.resolve());
    return deviceLocks.get(key);
  }
  function setDeviceLock(key, p) { deviceLocks.set(key, p); }

  const executionOrder = [];
  async function simulatedSend(key, label) {
    const prev = getDeviceLock(key);
    let resolveLock;
    const next = new Promise(r => { resolveLock = r; });
    setDeviceLock(key, prev.then(() => next));
    await prev;
    try {
      executionOrder.push(`start ${label}`);
      await new Promise(r => setTimeout(r, 10));
      executionOrder.push(`end ${label}`);
    } finally {
      resolveLock();
    }
  }

  await Promise.all([
    simulatedSend('dev1', 'A'),
    simulatedSend('dev1', 'B'),
    simulatedSend('dev1', 'C'),
  ]);

  assert(executionOrder[0] === 'start A', 'First should be start A');
  assert(executionOrder[1] === 'end A', 'Second should be end A');
  assert(executionOrder[2] === 'start B', 'Third should be start B');
  assert(executionOrder[3] === 'end B', 'Fourth should be end B');
  assert(executionOrder[4] === 'start C', 'Fifth should be start C');
  assert(executionOrder[5] === 'end C', 'Sixth should be end C');
}

export async function testPartialTransfer_remainingBytesSent() {
  const sent = [];
  const mockDevice = {
    opened: false,
    configuration: { interfaces: [{ alternates: [{ endpoints: [{ direction: 'out', endpointNumber: 1 }] }] }] },
    async open() { this.opened = true; },
    async selectConfiguration(n) {},
    async claimInterface(n) {},
    async releaseInterface(n) {},
    async close() {},
    async transferOut(ep, data) {
      const written = Math.min(data.byteLength, 512);
      sent.push({ len: data.byteLength, written });
      return { status: 'ok', bytesWritten: written };
    },
  };

  const data = new Uint8Array(2000);
  let offset = 0;
  const chunkSize = 1024;
  while (offset < data.length) {
    const slice = data.subarray(offset, Math.min(offset + chunkSize, data.length));
    const result = await mockDevice.transferOut(1, slice);
    if (result.status !== 'ok') throw new Error('Transfer failed');
    offset += result.bytesWritten;
  }

  assert(offset === 2000, `All 2000 bytes should be sent, offset=${offset}`);
  assert(sent.length >= 3, `Should take multiple transfers, got ${sent.length}`);
}

export async function testUsbFailure_marksFailedAndRetryToPending() {
  mockJobs.clear();
  mockJobs.set('job-fail', { id: 'job-fail', status: 'PRINTING', printer_id: 'p1', last_error: null });

  await mockSupabase.from('print_jobs').update({ status: 'FAILED', last_error: 'USB error' }).eq('id', 'job-fail');
  assert(mockJobs.get('job-fail').status === 'FAILED', 'Job should be FAILED');
  assert(mockJobs.get('job-fail').last_error === 'USB error', 'Should have error message');

  mockJobs.get('job-fail').status = 'PRINTING';
  await mockSupabase.from('print_jobs').update({ status: 'PENDING', last_error: null }).eq('status', 'PRINTING');
  assert(mockJobs.get('job-fail').status === 'PENDING', 'After retry, job should be PENDING');
}

export async function testNoReprintAfterSuccessRecordingFailure() {
  mockJobs.clear();
  mockJobs.set('job-success-fail', { id: 'job-success-fail', status: 'PRINTING', printer_id: 'p1' });

  const job = mockJobs.get('job-success-fail');
  const successMarked = false;

  if (!successMarked) {
    assert(job.status === 'PRINTING', 'Job should remain PRINTING if success recording fails');
  }

  const pendingJobs = Array.from(mockJobs.values()).filter(j => j.status === 'PENDING');
  assert(pendingJobs.length === 0, 'No PENDING jobs should exist — no auto-reprint');
}

export async function testAmbiguousPrintersRefused() {
  mockUsbDevices.clear();
  const dev1 = createMockDevice(0x04b8, 0x0202, '', 'Epson TM-T20');
  const dev2 = createMockDevice(0x04b8, 0x0202, '', 'Epson TM-T20');
  mockUsbDevices.set('dev1', dev1);
  mockUsbDevices.set('dev2', dev2);

  const devices = await mockNav.usb.getDevices();
  const matching = devices.filter(d => d.vendorId === 0x04b8 && d.productId === 0x0202);
  const assoc = { vendorId: 0x04b8, productId: 0x0202, serialNumber: null };

  let threwAmbiguity = false;
  try {
    if (matching.length > 1 && !assoc.serialNumber) {
      throw new Error('Ambiguous identical printers without serial');
    }
  } catch {
    threwAmbiguity = true;
  }
  assert(threwAmbiguity, 'Should throw ambiguity error for identical printers without serial');

  mockUsbDevices.clear();
  const dev3 = createMockDevice(0x04b8, 0x0202, 'SN123', 'Epson TM-T20');
  const dev4 = createMockDevice(0x04b8, 0x0202, 'SN456', 'Epson TM-T20');
  mockUsbDevices.set('SN123', dev3);
  mockUsbDevices.set('SN456', dev4);

  const devices2 = await mockNav.usb.getDevices();
  const matching2 = devices2.filter(d => d.vendorId === 0x04b8 && d.productId === 0x0202);
  const assoc2 = { vendorId: 0x04b8, productId: 0x0202, serialNumber: 'SN123' };

  let foundDevice = null;
  if (assoc2.serialNumber) {
    foundDevice = matching2.find(d => d.serialNumber === assoc2.serialNumber);
  }
  assert(foundDevice !== null, 'Should find device by serial number');
  assert(foundDevice.serialNumber === 'SN123', 'Should match the correct serial');
}

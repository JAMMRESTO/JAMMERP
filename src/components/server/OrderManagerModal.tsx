import PrintActionsModal from './PrintActionsModal';
import { Order, OrderItem } from '../../lib/types';

interface Props {
  order: Order & { table?: { nom: string }; items?: OrderItem[] };
  onClose: () => void;
  onRefresh: () => void;
}

export default function OrderManagerModal(props: Props) {
  return <PrintActionsModal {...props} />;
}

import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCaisse } from './hooks/useCaisse';
import { useSociete } from './hooks/useSociete';
import { useLicense } from './hooks/useLicense';
import LoginPage from './components/LoginPage';
import LicenseActivationPage from './components/LicenseActivationPage';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import EncaissementPage from './pages/EncaissementPage';
import DecaissementPage from './pages/DecaissementPage';
import HistoriquePage from './pages/HistoriquePage';
import ClotureCaissePage from './pages/ClotureCaissePage';
import ParametresPage from './pages/ParametresPage';
import StatistiquesPage from './pages/StatistiquesPage';

const CAISSIER_PAGES = ['home', 'encaissement', 'decaissement', 'historique', 'cloture'];

export default function App() {
  const { status: licenseStatus, loading: licenseLoading, activate, getMachineId } = useLicense();
  const { user, loading: authLoading, signIn, signOut } = useAuth();
  const { caisses, caisseActive, selectCaisse } = useCaisse(user?.id ?? null, user?.role);
  const societe = useSociete();
  const [page, setPage] = useState('home');
  const [machineId, setMachineId] = useState('');

  useEffect(() => {
    getMachineId().then(setMachineId);
  }, []);

  // Loading state
  if (licenseLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center animate-pulse">
            <span className="text-white font-black text-sm">MC</span>
          </div>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // License not valid -> show activation page
  if (!licenseStatus?.valid) {
    return <LicenseActivationPage machineId={machineId} onActivate={activate} />;
  }

  // Not logged in
  if (!user) {
    return <LoginPage onLogin={signIn} />;
  }

  const isCaissier = user.role === 'caissier';

  const navigate = (p: string) => {
    if (isCaissier && !CAISSIER_PAGES.includes(p)) return;
    setPage(p);
  };

  const safePage = isCaissier && !CAISSIER_PAGES.includes(page) ? 'home' : page;

  return (
    <div className="h-screen overflow-hidden bg-gray-50 flex flex-col">
      <Header
        userName={user.nom}
        userRole={user.role}
        caisses={caisses}
        caisseActive={caisseActive}
        onSelectCaisse={selectCaisse}
        onSignOut={signOut}
        currentPage={safePage}
        onNavigate={navigate}
        societeNom={societe?.nom}
        licenseClient={licenseStatus.payload?.client}
        licenseDaysRemaining={licenseStatus.daysRemaining}
      />
      <main className="flex-1 overflow-hidden">
        {safePage === 'home' && (
          <HomePage
            caisseActive={caisseActive}
            caisses={caisses}
            userRole={user.role}
            onNavigate={navigate}
            societeNom={societe?.nom}
          />
        )}
        {safePage === 'encaissement' && (
          <EncaissementPage
            caisseActive={caisseActive}
            userId={user.id}
            onNavigate={navigate}
          />
        )}
        {safePage === 'decaissement' && (
          <DecaissementPage
            caisseActive={caisseActive}
            userId={user.id}
            onNavigate={navigate}
          />
        )}
        {safePage === 'historique' && (
          <HistoriquePage
            caisseActive={caisseActive}
            caisses={caisses}
            userRole={user.role}
          />
        )}
        {safePage === 'cloture' && (
          <ClotureCaissePage
            caisseActive={caisseActive}
            userId={user.id}
            userRole={user.role}
          />
        )}
        {safePage === 'statistiques' && <StatistiquesPage />}
        {safePage === 'parametres' && <ParametresPage />}
      </main>
    </div>
  );
}

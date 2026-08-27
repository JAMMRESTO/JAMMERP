import LoginForm from './LoginForm';

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/Logo_moderne_avec_soleil_et_graphique.png"
            alt="SUNUFACTURE"
            className="h-28 w-auto mx-auto mb-2 drop-shadow-2xl"
          />
          <p className="text-blue-300 mt-1 text-sm">Votre solution de facturation professionnelle</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

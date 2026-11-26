import React from 'react';
import { Link } from 'react-router-dom';
import { Landmark, ShieldCheck } from 'lucide-react';

export function DonatePage() {
  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300">
          <Landmark className="h-6 w-6" />
        </div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Financial transparency</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Support through verified channels</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
          HumanityBridge does not accept online payments or collect card details through this website. Any contribution must be made directly through an independently confirmed organisational bank account.
        </p>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <strong>Protect yourself from fraud.</strong> Do not transfer funds to a personal account or rely on bank details sent through an unverified message. Contact the organisation through its officially published channels to confirm current bank instructions before making a transfer.
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
            External transfers are recorded separately by authorised staff. Supporting bank evidence is reviewed before an organisational acknowledgement receipt can be issued. This website does not initiate or settle bank transactions.
          </p>
        </div>
        <Link to="/" className="mt-8 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold text-white hover:bg-slate-800 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300">
          Return to HumanityBridge
        </Link>
      </section>
    </main>
  );
}

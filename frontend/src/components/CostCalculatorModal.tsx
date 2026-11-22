import React, { useState } from 'react';

interface CostCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (summary: string) => void;
}

export const CostCalculatorModal: React.FC<CostCalculatorModalProps> = ({
  isOpen,
  onClose,
  onInsertToChat
}) => {
  const [country, setCountry] = useState<'germany' | 'uk' | 'usa' | 'canada' | 'australia' | 'ireland' | 'france'>('germany');
  const [tuitionPerYear, setTuitionPerYear] = useState<number>(0);
  const [durationYears, setDurationYears] = useState<number>(2);
  const [isLondon, setIsLondon] = useState<boolean>(false);
  const [showLoanCalc, setShowLoanCalc] = useState<boolean>(false);
  const [loanAmountLakhs, setLoanAmountLakhs] = useState<number>(25);
  const [loanType, setLoanType] = useState<'unsecured' | 'secured'>('unsecured');

  if (!isOpen) return null;

  // Real-time approximate FX Rates to INR
  const fxEUR = 90.5;
  const fxGBP = 106.0;
  const fxUSD = 84.5;
  const fxCAD = 62.0;
  const fxAUD = 55.0;

  const calculateBreakdown = () => {
    if (country === 'germany') {
      const blockedAccountEur = 11904;
      const semesterContribEur = 350 * 2;
      const insuranceEur = 130 * 12;
      const visaFeeEur = 75;
      const apsFeeInr = 18000;
      const tuitionEur = tuitionPerYear;

      const totalEurYear1 = blockedAccountEur + semesterContribEur + insuranceEur + tuitionEur;
      const totalInrYear1 = (totalEurYear1 * fxEUR) + apsFeeInr + (visaFeeEur * fxEUR);

      return {
        countryName: 'Germany',
        currencyCode: 'EUR',
        tuition: tuitionEur,
        livingBlocked: blockedAccountEur,
        insuranceSemester: semesterContribEur + insuranceEur,
        visaAps: `€75 Visa + ₹18k APS`,
        totalForeign: totalEurYear1,
        totalInr: Math.round(totalInrYear1),
        livingLabel: 'Blocked Account (Sperrkonto / 1st Year)',
        notes: 'Public universities have €0 tuition fees. Only semester contribution (~€350/sem) applies.'
      };
    } else if (country === 'uk') {
      const maintenancePerMonth = isLondon ? 1334 : 1023;
      const livingFundsGbp = maintenancePerMonth * 9;
      const ihsPerYear = 776;
      const visaFeeGbp = 490;
      const tuitionGbp = tuitionPerYear > 0 ? tuitionPerYear : 16000;

      const totalGbp = livingFundsGbp + (ihsPerYear * durationYears) + visaFeeGbp + tuitionGbp;
      const totalInr = totalGbp * fxGBP;

      return {
        countryName: 'United Kingdom',
        currencyCode: 'GBP',
        tuition: tuitionGbp,
        livingBlocked: livingFundsGbp,
        insuranceSemester: ihsPerYear * durationYears,
        visaAps: `£490 Visa`,
        totalForeign: totalGbp,
        totalInr: Math.round(totalInr),
        livingLabel: `UKVI Maintenance (9 Months ${isLondon ? 'Inside London' : 'Outside London'})`,
        notes: 'Funds must be held in your bank account for 28 consecutive days before visa submission.'
      };
    } else if (country === 'usa') {
      const tuitionUsd = tuitionPerYear > 0 ? tuitionPerYear : 28000;
      const livingUsd = 15000;
      const sevisAndVisa = 350 + 185; // SEVIS + MRV
      const insuranceUsd = 1800;

      const totalUsd = tuitionUsd + livingUsd + sevisAndVisa + insuranceUsd;
      const totalInr = totalUsd * fxUSD;

      return {
        countryName: 'United States',
        currencyCode: 'USD',
        tuition: tuitionUsd,
        livingBlocked: livingUsd,
        insuranceSemester: insuranceUsd,
        visaAps: `$350 SEVIS + $185 MRV`,
        totalForeign: totalUsd,
        totalInr: Math.round(totalInr),
        livingLabel: 'Estimated Living & Housing (1st Year)',
        notes: 'I-20 requires 1 full year liquid proof. 36-month STEM OPT allows rapid payback post-graduation.'
      };
    } else if (country === 'canada') {
      const tuitionCad = tuitionPerYear > 0 ? tuitionPerYear : 22000;
      const gicCad = 20635; // Mandatory GIC
      const permitAndBio = 150 + 85;
      const insuranceCad = 800;

      const totalCad = tuitionCad + gicCad + permitAndBio + insuranceCad;
      const totalInr = totalCad * fxCAD;

      return {
        countryName: 'Canada',
        currencyCode: 'CAD',
        tuition: tuitionCad,
        livingBlocked: gicCad,
        insuranceSemester: insuranceCad,
        visaAps: `$150 Permit + $85 Bio`,
        totalForeign: totalCad,
        totalInr: Math.round(totalInr),
        livingLabel: 'Guaranteed Investment Certificate (GIC)',
        notes: 'GIC (CAD $20,635) is deposited in a Canadian bank and disbursed monthly after your arrival.'
      };
    } else if (country === 'australia') {
      const tuitionAud = tuitionPerYear > 0 ? tuitionPerYear : 32000;
      const livingAud = 29710; // DHA benchmark
      const oshcAndVisa = 750 + 710;

      const totalAud = tuitionAud + livingAud + oshcAndVisa;
      const totalInr = totalAud * fxAUD;

      return {
        countryName: 'Australia',
        currencyCode: 'AUD',
        tuition: tuitionAud,
        livingBlocked: livingAud,
        insuranceSemester: 750,
        visaAps: `$710 Visa (Subclass 500)`,
        totalForeign: totalAud,
        totalInr: Math.round(totalInr),
        livingLabel: 'DHA Living Financial Capacity Benchmark',
        notes: 'Genuine Student (GS) criteria requires proof of living benchmark + 1st year tuition.'
      };
    } else if (country === 'ireland') {
      const livingFundsEur = 10000;
      const insuranceEur = 600;
      const visaFeeEur = 100;
      const tuitionEur = tuitionPerYear > 0 ? tuitionPerYear : 14000;

      const totalEur = livingFundsEur + insuranceEur + visaFeeEur + tuitionEur;
      const totalInr = totalEur * fxEUR;

      return {
        countryName: 'Ireland',
        currencyCode: 'EUR',
        tuition: tuitionEur,
        livingBlocked: livingFundsEur,
        insuranceSemester: insuranceEur,
        visaAps: `€100 Visa`,
        totalForeign: totalEur,
        totalInr: Math.round(totalInr),
        livingLabel: 'Required Proof of Living Funds',
        notes: 'Proof of €10,000 living funds plus full year 1 tuition fee required.'
      };
    } else {
      // France
      const livingEur = 615 * 12; // €7380
      const visaFeeEur = 99;
      const tuitionEur = tuitionPerYear > 0 ? tuitionPerYear : 3770;
      const totalEur = livingEur + visaFeeEur + tuitionEur;
      const totalInr = totalEur * fxEUR;

      return {
        countryName: 'France',
        currencyCode: 'EUR',
        tuition: tuitionEur,
        livingBlocked: livingEur,
        insuranceSemester: 250,
        visaAps: `€99 Visa`,
        totalForeign: totalEur,
        totalInr: Math.round(totalInr),
        livingLabel: 'Campus France Living Requirement',
        notes: 'Minimum €615/month required. Public universities feature subsidized tuition.'
      };
    }
  };

  const b = calculateBreakdown();

  // Education Loan Calculation (10-year tenure = 120 months)
  const principal = loanAmountLakhs * 100000;
  const annualRate = loanType === 'secured' ? 0.09 : 0.11; // 9% secured vs 11% unsecured
  const monthlyRate = annualRate / 12;
  const months = 120;
  const estimatedEmi = Math.round(
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1)
  );

  const handleInsert = () => {
    if (onInsertToChat) {
      const formatted = `**${b.countryName} Study Abroad Cost Breakdown**\n\n- **1st Year Total Estimate**: ₹${b.totalInr.toLocaleString()} (~${b.currencyCode} ${b.totalForeign.toLocaleString()})\n- **${b.livingLabel}**: ${b.currencyCode} ${b.livingBlocked.toLocaleString()}\n- **Tuition**: ${tuitionPerYear === 0 ? '€0 (Public Univ)' : `${b.currencyCode} ${b.tuition.toLocaleString()}`}\n- **Regulatory & Visa Fees**: ${b.visaAps}\n\n*Note*: ${b.notes}\n\nCan Margam assist me with education loan options or scholarship strategies for this budget?`;
      onInsertToChat(formatted);
      onClose();
    }
  };

  const loanWhatsAppUrl = `https://wa.me/919347997790?text=${encodeURIComponent(
    `Hi Margam Loan Desk! I calculated my study abroad budget for ${b.countryName} (₹${b.totalInr.toLocaleString()}). I would like assistance with an ${
      loanType === 'secured' ? 'SBI / Govt Secured Loan' : 'HDFC Credila / Avanse Non-Collateral Loan'
    } for ₹${loanAmountLakhs} Lakhs.`
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-3xl max-w-xl w-full max-h-[92vh] shadow-2xl border border-slate-800 animate-stage overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ₹
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Study Abroad Cost & Loan Simulator</h3>
              <p className="text-xs text-slate-400">Live INR conversion, blocked accounts & loan EMI calculator</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Country Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Study Destination
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'germany', label: 'Germany', code: 'DE' },
                { id: 'uk', label: 'UK', code: 'UK' },
                { id: 'usa', label: 'USA', code: 'US' },
                { id: 'canada', label: 'Canada', code: 'CA' },
                { id: 'australia', label: 'Australia', code: 'AU' },
                { id: 'ireland', label: 'Ireland', code: 'IE' },
                { id: 'france', label: 'France', code: 'FR' },
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCountry(c.id as any);
                    if (c.id === 'germany') setTuitionPerYear(0);
                    else if (c.id === 'uk') setTuitionPerYear(16000);
                    else if (c.id === 'usa') setTuitionPerYear(28000);
                    else if (c.id === 'canada') setTuitionPerYear(22000);
                    else if (c.id === 'australia') setTuitionPerYear(32000);
                    else if (c.id === 'ireland') setTuitionPerYear(14000);
                    else setTuitionPerYear(3770);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    country === c.id
                      ? 'border-blue-500 bg-blue-600/20 text-blue-300 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-900/50 text-blue-300 border border-blue-800/60">{c.code}</span>
                  <span className="truncate">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Options */}
          {country === 'uk' && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <input
                type="checkbox"
                id="london-toggle"
                checked={isLondon}
                onChange={e => setIsLondon(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-700 bg-slate-900 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="london-toggle" className="text-xs font-medium text-slate-300 cursor-pointer">
                University is located inside Greater London (Requires £1,334/mo maintenance vs £1,023/mo outside)
              </label>
            </div>
          )}

          {/* Tuition input */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Annual Tuition ({b.currencyCode})
              </label>
              <span className="text-xs text-blue-400 font-bold">
                {tuitionPerYear === 0 ? '€0 (Public Univ)' : `${b.currencyCode} ${tuitionPerYear.toLocaleString()}`}
              </span>
            </div>
            <input
              type="number"
              value={tuitionPerYear}
              onChange={e => setTuitionPerYear(Math.max(0, Number(e.target.value)))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 text-sm focus:outline-none focus:border-blue-500 bg-slate-800 text-white placeholder-slate-500 transition-colors"
              placeholder="0"
            />
            {country === 'germany' && (
              <p className="text-[11px] text-slate-400 mt-1">
                Tip: Most public universities in Germany charge €0 tuition (only ~€350/sem admin & transit ticket applies).
              </p>
            )}
          </div>

          {/* Result Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-lg space-y-3">
            <div className="flex justify-between items-start border-b border-slate-700/60 pb-3">
              <div>
                <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  Estimated 1st Year Proof of Funds
                </span>
                <h4 className="text-3xl font-extrabold text-white mt-0.5">
                  ₹{b.totalInr.toLocaleString()}
                </h4>
                <p className="text-xs text-blue-300 font-medium">
                  ≈ {b.currencyCode} {b.totalForeign.toLocaleString()}
                </p>
              </div>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-xl text-xs font-semibold border border-blue-400/30">
                {b.countryName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs pt-1">
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px] truncate">{b.livingLabel}</span>
                <span className="font-bold text-white text-sm">
                  {b.currencyCode} {b.livingBlocked.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px]">Tuition Fee</span>
                <span className="font-bold text-white text-sm">
                  {tuitionPerYear === 0 ? '€0 (Free)' : `${b.currencyCode} ${b.tuition.toLocaleString()}`}
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px]">Insurance / Surcharge</span>
                <span className="font-semibold text-white">
                  {b.currencyCode} {b.insuranceSemester.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[11px]">Visa / Regulatory</span>
                <span className="font-semibold text-white truncate">{b.visaAps}</span>
              </div>
            </div>

            <div className="flex items-start gap-1.5 text-[11px] text-slate-400 italic pt-1 border-t border-slate-700/40">
              <svg className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{b.notes}</span>
            </div>
          </div>

          {/* Education Loan Simulator Section */}
          <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span className="font-bold text-xs text-blue-300 uppercase tracking-wider">
                  Education Loan EMI Simulator
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLoanCalc(!showLoanCalc)}
                className="text-xs text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                {showLoanCalc ? 'Hide Loan Tool' : 'Calculate EMI & Loans'}
              </button>
            </div>

            {showLoanCalc && (
              <div className="space-y-3 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoanType('unsecured')}
                    className={`p-2 rounded-xl border text-center font-semibold text-xs transition-colors cursor-pointer ${
                      loanType === 'unsecured'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    Non-Collateral (Up to ₹50L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoanType('secured')}
                    className={`p-2 rounded-xl border text-center font-semibold text-xs transition-colors cursor-pointer ${
                      loanType === 'secured'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    Secured / Govt (Up to ₹1.5 Cr)
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px] font-semibold text-slate-300 mb-1">
                    <span>Loan Required: ₹{loanAmountLakhs} Lakhs</span>
                    <span className="text-blue-400 font-bold">Estimated EMI: ₹{estimatedEmi.toLocaleString()}/mo</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    step="5"
                    value={loanAmountLakhs}
                    onChange={e => setLoanAmountLakhs(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>₹5L</span>
                    <span>₹40L</span>
                    <span>₹80L</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-300">
                    <span className="font-bold text-white">Margam Loan Desk:</span> Direct tie-ups with SBI, HDFC Credila, Avanse (0 processing fees).
                  </div>
                  <a
                    href={loanWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs active:scale-95 cursor-pointer shrink-0"
                  >
                    Talk to Loan Mentor
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          {onInsertToChat && (
            <button
              onClick={handleInsert}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Insert into Consultation Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

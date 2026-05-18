export const metadata = {
  title: 'Analisis Data',
  description: 'Platform analisis data terintegrasi',
};

export default function AnalysisLayout({ children }) {
  return (
    <div className="analysis-layout">
      <main>{children}</main>
    </div>
  );
}
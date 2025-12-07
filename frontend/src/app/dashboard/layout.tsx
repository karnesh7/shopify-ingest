export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Shopify Insights</h1>
      {children}
    </div>
  );
}
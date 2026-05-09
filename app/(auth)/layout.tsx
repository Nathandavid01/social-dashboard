export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">AgencyFlow</h1>
          <p className="text-muted-foreground mt-1">Social Media Operations Dashboard</p>
        </div>
        {children}
      </div>
    </div>
  )
}

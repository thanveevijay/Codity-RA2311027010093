import { useState, useEffect } from 'react'
import api from '../api'

interface Stats {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  pendingJobs: number
  activeWorkers: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/workers/stats')
        setStats(response.data)
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Jobs', value: stats?.totalJobs || 0, color: 'blue' },
    { label: 'Completed', value: stats?.completedJobs || 0, color: 'green' },
    { label: 'Failed', value: stats?.failedJobs || 0, color: 'red' },
    { label: 'Pending', value: stats?.pendingJobs || 0, color: 'yellow' },
    { label: 'Active Workers', value: stats?.activeWorkers || 0, color: 'purple' },
  ]

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    purple: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className={`p-6 rounded-lg shadow-sm border ${colorClasses[stat.color as keyof typeof colorClasses]}`}
            >
              <div className="text-3xl font-bold">{stat.value}</div>
              <div className="text-sm opacity-80">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-6 bg-white rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h2>
          <p className="text-gray-600">
            Welcome to the Job Scheduler Dashboard. Use the navigation above to manage queues,
            view jobs, and monitor workers.
          </p>
        </div>
      </div>
    </div>
  )
}

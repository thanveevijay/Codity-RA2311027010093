import { useState, useEffect } from 'react'
import api from '../api'

interface Queue {
  id: string
  name: string
  description: string | null
  priority: number
  concurrencyLimit: number
  isPaused: boolean
  pendingJobs: number
}

interface Project {
  id: string
  name: string
  slug: string
}

export default function Queues() {
  const [queues, setQueues] = useState<Queue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('0')
  const [concurrencyLimit, setConcurrencyLimit] = useState('5')
  const [selectedProjectId, setSelectedProjectId] = useState('')

  useEffect(() => {
    Promise.all([fetchQueues(), fetchProjects()])
  }, [])

  const fetchQueues = async () => {
    try {
      const response = await api.get('/queues')
      setQueues(response.data)
    } catch (err) {
      console.error('Failed to fetch queues:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await api.get('/projects')
      setProjects(response.data)
      if (response.data.length > 0) {
        setSelectedProjectId(response.data[0].id)
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/queues', {
        name,
        description,
        projectId: selectedProjectId,
        priority: parseInt(priority),
        concurrencyLimit: parseInt(concurrencyLimit),
      })
      setName('')
      setDescription('')
      setShowForm(false)
      fetchQueues()
    } catch (err) {
      console.error('Failed to create queue:', err)
    }
  }

  const handleTogglePause = async (queue: Queue) => {
    try {
      if (queue.isPaused) {
        await api.put(`/queues/${queue.id}/resume`)
      } else {
        await api.put(`/queues/${queue.id}/pause`)
      }
      fetchQueues()
    } catch (err) {
      console.error('Failed to toggle queue:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Queues</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Create Queue'}
          </button>
        </div>

        {showForm && (
          <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Create New Queue</h2>
            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concurrency Limit</label>
                  <input
                    type="number"
                    value={concurrencyLimit}
                    onChange={(e) => setConcurrencyLimit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Queue
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {queues.map((queue) => (
            <div key={queue.id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{queue.name}</h3>
                  {queue.description && (
                    <p className="text-gray-600 text-sm mt-1">{queue.description}</p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    queue.isPaused
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {queue.isPaused ? 'Paused' : 'Active'}
                </span>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Priority:</span>
                  <span className="font-medium">{queue.priority}</span>
                </div>
                <div className="flex justify-between">
                  <span>Concurrency:</span>
                  <span className="font-medium">{queue.concurrencyLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending Jobs:</span>
                  <span className="font-medium">{queue.pendingJobs}</span>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => handleTogglePause(queue)}
                  className={`w-full px-3 py-2 rounded-md text-sm font-medium ${
                    queue.isPaused
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  {queue.isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

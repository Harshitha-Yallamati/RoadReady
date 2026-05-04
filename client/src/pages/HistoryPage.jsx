import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { History, Trash2, MapPin, Clock, Zap, ArrowRight, BarChart3, Navigation2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getHistory, deleteHistory, getStats } from '../services/api';
import toast from 'react-hot-toast';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [stats, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [histRes, statRes] = await Promise.all([getHistory(), getStats()]);
      setHistory(histRes.data.history || []);
      setStatsData(statRes.data);
    } catch {
      // Still show empty state
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    try {
      await deleteHistory(id);
      setHistory(h => h.filter(item => item._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-surface-100 flex items-center gap-3">
              <History className="w-8 h-8 text-primary-400" />
              Route History
            </h1>
            <p className="text-surface-400 mt-1">Your past route optimizations</p>
          </div>
          <Link to="/planner" className="btn-primary flex items-center gap-2">
            <Zap className="w-4 h-4" /> New Route
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass p-4 text-center">
              <div className="text-2xl font-bold text-primary-400">{stats.totalSearches}</div>
              <div className="text-xs text-surface-400 mt-1">Total Searches</div>
            </div>
            {Object.entries(stats.preferenceBreakdown || {}).map(([pref, count]) => (
              <div key={pref} className="glass p-4 text-center">
                <div className="text-2xl font-bold text-accent-cyan">{count}</div>
                <div className="text-xs text-surface-400 mt-1 capitalize">{pref.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        )}

        {/* History List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-24" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="glass p-12 text-center">
            <BarChart3 className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-surface-300">No routes yet</h3>
            <p className="text-surface-500 mt-1">Start planning routes to see your history here.</p>
            <Link to="/planner" className="btn-primary inline-flex items-center gap-2 mt-6">
              <Zap className="w-4 h-4" /> Plan Your First Route
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item, idx) => (
              <motion.div
                key={item._id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass p-4 group hover:border-primary-500/20 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-accent-green shrink-0" />
                      <span className="font-medium text-surface-200">{item.source?.name || 'Unknown'}</span>
                      <ArrowRight className="w-3 h-3 text-surface-500" />
                      <MapPin className="w-4 h-4 text-accent-rose shrink-0" />
                      <span className="font-medium text-surface-200">{item.destination?.name || 'Unknown'}</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                      <span className="capitalize px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-400">
                        {item.preference?.replace('_', ' ')}
                      </span>
                      {item.selectedRoute && (
                        <>
                          <span>{(item.selectedRoute.distance / 1000).toFixed(1)} km</span>
                          <span>{Math.round((item.selectedRoute.adjustedDuration || item.selectedRoute.duration) / 60)} min</span>
                          <span>₹{item.selectedRoute.estimatedCost}</span>
                        </>
                      )}
                      {item.weatherCondition && (
                        <span className="text-accent-cyan">{item.weatherCondition}</span>
                      )}
                    </div>

                    {item.aiExplanation && (
                      <p className="text-xs text-surface-500 mt-2 line-clamp-1">{item.aiExplanation}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-xs text-surface-600 whitespace-nowrap">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatDate(item.createdAt)}
                    </span>
                    {/* Re-open in Planner via dynamic route */}
                    <Link
                      to={`/planner/${item._id}`}
                      title="Re-open in Planner"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-blue-500/10 text-surface-500 hover:text-blue-400 transition-all"
                    >
                      <Navigation2 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-accent-rose/10 text-surface-500 hover:text-accent-rose transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

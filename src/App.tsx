import React, { useState, useEffect } from "react";
import { Twitter, Calendar, Loader2, Send, Clock, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto border border-zinc-800">
              <Twitter className="w-8 h-8 text-zinc-100" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">X-Auto</h1>
            <p className="text-zinc-400 text-lg">
              Post instantly or schedule for later.
            </p>
          </div>

          <div className="text-sm text-zinc-500 text-left bg-zinc-900/50 p-6 rounded-xl border border-zinc-800/50 space-y-4">
            <p className="font-medium text-zinc-300 text-base text-center">API Keys Required</p>
            <p className="text-center">Please add your Twitter API keys to the <strong>Secrets</strong> panel in AI Studio.</p>
            <ul className="list-disc list-inside space-y-2 text-zinc-400 text-xs">
              <li><code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">TWITTER_CONSUMER_KEY</code></li>
              <li><code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">TWITTER_CONSUMER_SECRET</code></li>
              <li><code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">TWITTER_ACCESS_TOKEN</code></li>
              <li><code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">TWITTER_ACCESS_TOKEN_SECRET</code></li>
            </ul>
            <button 
              onClick={fetchUser}
              className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Twitter className="w-4 h-4" />
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/30 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
              <Twitter className="w-4 h-4 text-zinc-100" />
            </div>
            <span className="font-bold tracking-tight text-xl">X-Auto</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-zinc-500">@{user.username}</p>
            </div>
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-bold border border-zinc-700">
              {user.name?.charAt(0) || user.username?.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <Composer user={user} />
      </main>
    </div>
  );
}

function Composer({ user }: { user: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isScheduling, setIsScheduling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePostNow = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/posts/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setContent("");
        setMessage({ type: 'success', text: 'Post published successfully!' });
        fetchPosts();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to post' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !date || !time) return;

    setSubmitting(true);
    setMessage(null);
    const scheduled_for = new Date(`${date}T${time}`).toISOString();

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, scheduled_for }),
      });
      if (res.ok) {
        setContent("");
        setDate("");
        setTime("");
        setIsScheduling(false);
        setMessage({ type: 'success', text: 'Post scheduled successfully!' });
        fetchPosts();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to schedule' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/posts/${id}`, { method: "DELETE" });
      fetchPosts();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8">
      {/* Composer Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-sm font-bold border border-zinc-700 mt-1">
            {user.name?.charAt(0) || user.username?.charAt(0)}
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
              className="w-full bg-transparent border-none text-zinc-100 text-lg placeholder:text-zinc-600 focus:ring-0 resize-none min-h-[120px]"
              maxLength={280}
              disabled={submitting}
            />
            <div className="h-px bg-zinc-800 my-4" />
            
            {isScheduling && (
              <div className="flex flex-wrap gap-4 mb-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500/50"
                    required
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500/50"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduling(!isScheduling)}
                  className={clsx(
                    "p-2 rounded-full transition-colors",
                    isScheduling ? "bg-indigo-500/20 text-indigo-400" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  )}
                  title="Schedule post"
                >
                  <Clock className="w-5 h-5" />
                </button>
                <span className={clsx(
                  "text-xs font-medium",
                  content.length > 260 ? "text-amber-500" : "text-zinc-500"
                )}>
                  {content.length}/280
                </span>
              </div>

              <div className="flex gap-3">
                {isScheduling ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsScheduling(false)}
                      className="px-4 py-2 rounded-full text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSchedule}
                      disabled={submitting || !content.trim() || !date || !time}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      Schedule
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handlePostNow}
                    disabled={submitting || !content.trim()}
                    className="bg-zinc-100 hover:bg-white disabled:opacity-50 text-zinc-900 px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className={clsx(
            "mt-4 p-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200",
            message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
          )}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}
      </div>

      {/* History / Queue Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-bold tracking-tight">Post History & Queue</h3>
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            {posts.length} {posts.length === 1 ? 'Post' : 'Posts'}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-700" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/20 rounded-3xl border border-zinc-800/50 border-dashed">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-zinc-800">
              <Twitter className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-zinc-500 font-medium">No posts yet.</p>
            <p className="text-zinc-600 text-sm mt-1">Your scheduled and published posts will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700 transition-colors group">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold border border-zinc-700 flex-shrink-0">
                    {user.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{user.name}</span>
                        <span className="text-zinc-500 text-xs">@{user.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                          post.status === 'published' ? "bg-emerald-500/10 text-emerald-500" :
                          post.status === 'failed' ? "bg-red-500/10 text-red-500" :
                          "bg-indigo-500/10 text-indigo-500"
                        )}>
                          {post.status}
                        </span>
                        {post.status === 'scheduled' && (
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            title="Cancel schedule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap mb-3">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(post.scheduled_for).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


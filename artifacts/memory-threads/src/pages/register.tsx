import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Brain, Loader2, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      await register(email, password);
      setLocation('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 mb-4">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Memory Threads</h1>
          <p className="text-muted-foreground mt-2 text-sm">Create your account</p>
        </div>

        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="h-11 bg-black/40 border-white/10 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  className="h-11 pr-11 bg-black/40 border-white/10 focus-visible:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                className="h-11 bg-black/40 border-white/10 focus-visible:ring-primary"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import TextInput from '../components/TextInput';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) setError('Incorrect email or password.');
  }

  return (
    <div className="mx-auto max-w-sm p-4">
      <PageHeader title="Sign in" />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextInput
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        New here?{' '}
        <Link to="/sign-up" className="underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

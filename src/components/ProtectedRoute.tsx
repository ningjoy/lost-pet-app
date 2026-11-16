import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import Spinner from './Spinner';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}

import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Feed from './pages/Feed';
import MyPets from './pages/MyPets';
import Pet from './pages/Pet';
import Profile from './pages/Profile';
import Report from './pages/Report';
import Settings from './pages/Settings';
import SignIn from './pages/SignIn';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Feed />} />
          <Route path="/my-pets" element={<MyPets />} />
          <Route path="/pets/:id" element={<Pet />} />
          <Route path="/report" element={<Report />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/sign-in" element={<SignIn />} />
      </Routes>
    </BrowserRouter>
  );
}

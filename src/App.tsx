import 'leaflet/dist/leaflet.css';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import MapTest from './components/MapTest';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home view with a link to the map test */}
        <Route
          path="/"
          element={
            <div className="p-8 font-sans">
              <h1 className="mb-4 text-2xl font-bold">Pet-Net Development</h1>
              <p className="mb-4 text-gray-600">
                Sprint: Leaflet Mobile & Desktop Validation
              </p>
              <Link
                to="/map-test"
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow hover:bg-blue-700"
              >
                View Leaflet Map Test (/map-test) 🗺️
              </Link>
            </div>
          }
        />

        <Route path="/map-test" element={<MapTest />} />
      </Routes>
    </BrowserRouter>
  );
}

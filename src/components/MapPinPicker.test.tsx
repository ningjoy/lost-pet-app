import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MapPinPicker from './MapPinPicker';

// jsdom cannot draw a map, so react-leaflet is replaced with stand-ins that
// expose the handlers the component registers.
const mapEvents = vi.hoisted(() => ({
  handlers: {} as { click?: (e: unknown) => void },
}));
const fakeMap = vi.hoisted(() => ({
  getBounds: vi.fn(),
  setView: vi.fn(),
}));
const markerHandlers = vi.hoisted(() => ({
  dragend: undefined as ((e: unknown) => void) | undefined,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    doubleClickZoom,
  }: {
    children: React.ReactNode;
    doubleClickZoom?: boolean;
  }) => (
    <div data-testid="map" data-double-click-zoom={String(doubleClickZoom)}>
      {children}
    </div>
  ),
  TileLayer: () => null,
  Marker: ({
    position,
    eventHandlers,
    draggable,
    icon,
  }: {
    position: [number, number];
    eventHandlers: { dragend: (e: unknown) => void };
    draggable?: boolean;
    icon?: { options: { iconSize: number[] } };
  }) => {
    markerHandlers.dragend = eventHandlers.dragend;
    return (
      <div
        data-testid="marker"
        data-draggable={String(draggable)}
        data-icon-size={icon?.options.iconSize.join(',')}
      >
        {position.join(',')}
      </div>
    );
  },
  useMapEvents: (handlers: { click: (e: unknown) => void }) => {
    mapEvents.handlers = handlers;
    return null;
  },
  useMap: () => fakeMap,
}));

type GeoSuccess = (pos: {
  coords: { latitude: number; longitude: number };
}) => void;
let geoSuccess: GeoSuccess | undefined;
let geoFail: (() => void) | undefined;
const getCurrentPosition = vi.fn((ok: GeoSuccess, fail: () => void) => {
  geoSuccess = ok;
  geoFail = fail;
});

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  fakeMap.getBounds.mockReturnValue({ contains: () => true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  geoSuccess = undefined;
  geoFail = undefined;
});

const alice = { lat: 40.1106, lng: -88.2073 };

describe('MapPinPicker', () => {
  test('draws the pin at the given value and does not ask for location', () => {
    render(<MapPinPicker value={alice} onChange={vi.fn()} />);
    expect(screen.getByTestId('marker')).toHaveTextContent('40.1106,-88.2073');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  test('the pin is draggable and uses the custom icon', () => {
    render(<MapPinPicker value={alice} onChange={vi.fn()} />);
    const marker = screen.getByTestId('marker');
    expect(marker).toHaveAttribute('data-draggable', 'true');
    expect(marker).toHaveAttribute('data-icon-size', '20,20');
  });

  test('double-tapping the map does not zoom, so it cannot move the pin', () => {
    render(<MapPinPicker value={alice} onChange={vi.fn()} />);
    expect(screen.getByTestId('map')).toHaveAttribute(
      'data-double-click-zoom',
      'false',
    );
  });

  test('a late location answer does not replace a value that loaded meanwhile', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MapPinPicker value={null} onChange={onChange} />,
    );
    rerender(<MapPinPicker value={alice} onChange={onChange} />);
    act(() => geoSuccess?.({ coords: { latitude: 40.5, longitude: -88.5 } }));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('draws extra layers passed as children', () => {
    render(
      <MapPinPicker value={alice} onChange={vi.fn()}>
        <div data-testid="circle" />
      </MapPinPicker>,
    );
    expect(screen.getByTestId('circle')).toBeInTheDocument();
  });

  test('tapping the map places the pin there', () => {
    const onChange = vi.fn();
    render(<MapPinPicker value={alice} onChange={onChange} />);
    act(() =>
      mapEvents.handlers.click?.({ latlng: { lat: 40.2, lng: -88.3 } }),
    );
    expect(onChange).toHaveBeenCalledWith({ lat: 40.2, lng: -88.3 });
  });

  test('dragging the pin reports where it was dropped', () => {
    const onChange = vi.fn();
    render(<MapPinPicker value={alice} onChange={onChange} />);
    act(() =>
      markerHandlers.dragend?.({
        target: { getLatLng: () => ({ lat: 40.3, lng: -88.4 }) },
      }),
    );
    expect(onChange).toHaveBeenCalledWith({ lat: 40.3, lng: -88.4 });
  });

  test('with no value, starts at the current location', () => {
    const onChange = vi.fn();
    render(<MapPinPicker value={null} onChange={onChange} />);
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
    act(() => geoSuccess?.({ coords: { latitude: 40.5, longitude: -88.5 } }));
    expect(onChange).toHaveBeenCalledWith({ lat: 40.5, lng: -88.5 });
  });

  test('leaves the pin unset when location is refused', () => {
    const onChange = vi.fn();
    render(<MapPinPicker value={null} onChange={onChange} />);
    act(() => geoFail?.());
    expect(onChange).not.toHaveBeenCalled();
  });

  test('a late location answer does not move a pin the user already placed', () => {
    const onChange = vi.fn();
    render(<MapPinPicker value={null} onChange={onChange} />);
    act(() =>
      mapEvents.handlers.click?.({ latlng: { lat: 40.2, lng: -88.3 } }),
    );
    act(() => geoSuccess?.({ coords: { latitude: 40.5, longitude: -88.5 } }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: 40.2, lng: -88.3 });
  });

  test('a location answer after unmount is ignored', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <MapPinPicker value={null} onChange={onChange} />,
    );
    unmount();
    geoSuccess?.({ coords: { latitude: 40.5, longitude: -88.5 } });
    expect(onChange).not.toHaveBeenCalled();
  });

  test('pans to the pin when it is outside the visible map', () => {
    fakeMap.getBounds.mockReturnValue({ contains: () => false });
    render(<MapPinPicker value={alice} onChange={vi.fn()} />);
    expect(fakeMap.setView).toHaveBeenCalledWith([alice.lat, alice.lng]);
  });

  test('does not pan when the pin is already visible', () => {
    render(<MapPinPicker value={alice} onChange={vi.fn()} />);
    expect(fakeMap.setView).not.toHaveBeenCalled();
  });
});

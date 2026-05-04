import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  PencilLine,
  Plus,
  Search,
  StickyNote,
  Tag,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRoute } from '../context/RouteContext';
import {
  addSavedPlace,
  deleteSavedPlace,
  geocodePlace,
  getSavedPlaces,
  reverseGeocode,
  updateSavedPlace,
} from '../services/api';

const CATEGORY_OPTIONS = ['home', 'work', 'favorite', 'food', 'scenic', 'other'];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createEmptyForm() {
  return {
    name: '',
    lat: '',
    lon: '',
    address: '',
    category: 'favorite',
    notes: '',
  };
}

function derivePlaceName(address = '') {
  return String(address || '')
    .split(',')
    .map((part) => part.trim())
    .find(Boolean) || '';
}

export default function SavedPlacesPage() {
  const navigate = useNavigate();
  const { dispatch } = useRoute();
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [form, setForm] = useState(createEmptyForm());
  const [editingPlace, setEditingPlace] = useState(null);
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    loadPlaces();
  }, []);

  async function loadPlaces() {
    setLoading(true);
    try {
      const res = await getSavedPlaces();
      setPlaces(res.data?.places || []);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to load saved places');
    } finally {
      setLoading(false);
    }
  }

  const filteredPlaces = places.filter((place) => {
    const search = deferredSearch.trim().toLowerCase();
    const matchesCategory = categoryFilter === 'all' || place.category === categoryFilter;
    if (!matchesCategory) return false;
    if (!search) return true;

    return [
      place.name,
      place.address,
      place.category,
      place.notes,
    ].some((value) => String(value || '').toLowerCase().includes(search));
  });

  const applyResolvedLocation = useCallback((place, target = 'create') => {
    const lat = Number(place?.lat);
    const lon = Number(place?.lon ?? place?.lng);
    const address = String(place?.name || '').trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      toast.error('Could not read coordinates for that address');
      return;
    }

    const patchState = (prev) => ({
      ...prev,
      address: address || prev.address,
      lat: lat.toFixed(6),
      lon: lon.toFixed(6),
      name: prev.name?.trim() ? prev.name : derivePlaceName(address),
    });

    if (target === 'edit') {
      setEditingPlace((prev) => (prev ? patchState(prev) : prev));
      return;
    }

    setForm((prev) => patchState(prev));
  }, []);

  async function handleUseCurrentLocation(target = 'create') {
    if (!navigator.geolocation) {
      toast.error('GPS is not supported in this browser');
      return;
    }

    const toastId = target === 'edit' ? 'saved-gps-edit' : 'saved-gps';
    toast.loading('Fetching current location...', { id: toastId });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        let resolvedAddress = '';

        try {
          const res = await reverseGeocode(Number(lat), Number(lon));
          resolvedAddress = res.data?.result?.name || '';
        } catch {
          resolvedAddress = '';
        }

        if (target === 'edit' && editingPlace) {
          setEditingPlace((prev) => (
            prev
              ? {
                  ...prev,
                  lat,
                  lon,
                  address: resolvedAddress || prev.address,
                  name: prev.name?.trim() ? prev.name : derivePlaceName(resolvedAddress),
                }
              : prev
          ));
        } else {
          setForm((prev) => ({
            ...prev,
            lat,
            lon,
            address: resolvedAddress || prev.address,
            name: prev.name?.trim() ? prev.name : derivePlaceName(resolvedAddress),
          }));
        }

        toast.success('Current coordinates added', { id: toastId });
      },
      () => toast.error('Could not access your location', { id: toastId }),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function handleAddPlace(e) {
    e.preventDefault();
    const payload = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
      lat: toNumber(form.lat),
      lon: toNumber(form.lon),
    };

    if (!payload.name || payload.lat === null || payload.lon === null) {
      toast.error('Name, latitude, and longitude are required');
      return;
    }

    setSaving(true);
    try {
      const res = await addSavedPlace(payload);
      const created = res.data?.place;
      if (created) {
        setPlaces((prev) => [created, ...prev]);
      }
      setForm(createEmptyForm());
      toast.success('Place saved');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save place');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingPlace) return;

    const payload = {
      ...editingPlace,
      name: editingPlace.name.trim(),
      address: String(editingPlace.address || '').trim(),
      notes: String(editingPlace.notes || '').trim(),
      lat: toNumber(editingPlace.lat),
      lon: toNumber(editingPlace.lon),
    };

    if (!payload.name || payload.lat === null || payload.lon === null) {
      toast.error('Name, latitude, and longitude are required');
      return;
    }

    try {
      const res = await updateSavedPlace(editingPlace._id, payload);
      const updated = res.data?.place;
      setPlaces((prev) => prev.map((place) => (place._id === updated._id ? updated : place)));
      setEditingPlace(null);
      toast.success('Place updated');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update place');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSavedPlace(id);
      setPlaces((prev) => prev.filter((item) => item._id !== id));
      toast.success('Place removed');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Delete failed');
    }
  }

  function handleNavigate(place) {
    const lon = Number(place.lon ?? place.lng);
    const destination = {
      name: place.name || place.address || `${place.lat}, ${lon}`,
      lat: Number(place.lat),
      lon,
    };

    dispatch({ type: 'SET_DESTINATION', payload: destination });
    navigate('/planner');
    toast.success('Destination loaded in planner');
  }

  return (
    <div style={{ minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 20 }}>
        <div
          style={{
            padding: 22,
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(15,23,42,0.92))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Bookmark style={{ width: 30, height: 30, color: '#93c5fd' }} />
                Saved Places
              </h1>
              <p style={{ color: '#cbd5e1', marginTop: 8, lineHeight: 1.7 }}>
                Keep your important locations in MongoDB, organize them by type, and jump straight back into navigation.
              </p>
            </div>

            <div style={{ minWidth: 240, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <SummaryCard label="All Places" value={places.length} />
                <SummaryCard label="Visible" value={filteredPlaces.length} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(0, 1.8fr)', gap: 20 }}>
          <form
            onSubmit={handleAddPlace}
            style={{
              padding: 20,
              borderRadius: 22,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              display: 'grid',
              gap: 14,
              alignContent: 'start',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Add a Place</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                Type an address just like the planner, pick a suggestion, and the coordinates will fill in automatically.
              </p>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(14,165,233,0.05))',
                border: '1px solid rgba(59,130,246,0.16)',
                display: 'grid',
                gap: 12,
              }}
            >
              <AddressAutocompleteField
                label="Search address"
                value={form.address}
                onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                onSelect={(place) => applyResolvedLocation(place, 'create')}
                placeholder="Type an address, landmark, or area name"
              />
              <div style={{ fontSize: 12, color: '#93c5fd', lineHeight: 1.6 }}>
                Select a result to auto-fill the map coordinates. You can still fine-tune them manually below.
              </div>
              <CoordinatePreview lat={form.lat} lon={form.lon} />
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)' }}>
              <Field label="Place name" icon={<Bookmark size={16} />}>
                <input
                  className="input-field"
                  placeholder="Home, Office, Favorite Cafe..."
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Field>

              <Field label="Category" icon={<Tag size={16} />}>
                <select
                  className="input-field"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Field label="Latitude" icon={<Crosshair size={16} />}>
                <input
                  className="input-field"
                  placeholder="Latitude"
                  value={form.lat}
                  onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
                />
              </Field>
              <Field label="Longitude" icon={<Crosshair size={16} />}>
                <input
                  className="input-field"
                  placeholder="Longitude"
                  value={form.lon}
                  onChange={(e) => setForm((prev) => ({ ...prev, lon: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Notes" icon={<StickyNote size={16} />}>
              <textarea
                className="input-field"
                placeholder="Helpful reminder, pickup instructions, best arrival time..."
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                style={{ minHeight: 92, resize: 'vertical' }}
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Place
              </button>
              <button
                type="button"
                onClick={() => handleUseCurrentLocation('create')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--panel-alt)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Crosshair className="w-4 h-4" />
                Use Current Location
              </button>
            </div>
          </form>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <div
              style={{
                padding: 18,
                borderRadius: 22,
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                display: 'grid',
                gap: 14,
              }}
            >
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    className="input-field"
                    placeholder="Search by name, address, category, or notes"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>

                <select
                  className="input-field"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: 160 }}
                >
                  <option value="all">All categories</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="skeleton h-28" />
                ))}
              </div>
            ) : filteredPlaces.length === 0 ? (
              <div
                style={{
                  padding: 34,
                  borderRadius: 22,
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <MapPin style={{ width: 42, height: 42, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>No matching places</h3>
                <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                  Add a place or adjust your search and category filters.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {filteredPlaces.map((place) => {
                  const lon = Number(place.lon ?? place.lng);
                  const category = String(place.category || 'favorite');

                  return (
                    <div
                      key={place._id}
                      style={{
                        padding: 18,
                        borderRadius: 22,
                        background: 'var(--panel)',
                        border: '1px solid var(--border)',
                        display: 'grid',
                        gap: 14,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div
                              style={{
                                padding: '6px 10px',
                                borderRadius: 999,
                                background: getCategoryColor(category).bg,
                                color: getCategoryColor(category).text,
                                fontSize: 12,
                                fontWeight: 700,
                                textTransform: 'capitalize',
                              }}
                            >
                              {category}
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>{place.name}</div>
                          </div>
                          <div style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>{place.address || 'No address provided'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            {Number(place.lat).toFixed(6)}, {Number(lon).toFixed(6)}
                          </div>
                          {place.notes && (
                            <div
                              style={{
                                marginTop: 4,
                                padding: '10px 12px',
                                borderRadius: 14,
                                background: 'rgba(59,130,246,0.08)',
                                border: '1px solid rgba(59,130,246,0.14)',
                                color: '#bfdbfe',
                                fontSize: 13,
                                lineHeight: 1.6,
                              }}
                            >
                              {place.notes}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'start', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleNavigate(place)}
                            className="btn-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                          >
                            <Navigation className="w-4 h-4" />
                            Navigate
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlace({
                              ...place,
                              lat: String(place.lat),
                              lon: String(place.lon ?? place.lng),
                            })}
                            style={secondaryButtonStyle}
                          >
                            <PencilLine className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(place._id)}
                            style={dangerButtonStyle}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editingPlace && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            background: 'rgba(2,6,23,0.72)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 620,
              borderRadius: 24,
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              padding: 22,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)' }}>Edit Saved Place</h2>
              <p style={{ marginTop: 6, color: 'var(--text-muted)' }}>
                Update the label or search for a new address to refresh its coordinates.
              </p>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(14,165,233,0.05))',
                border: '1px solid rgba(59,130,246,0.16)',
                display: 'grid',
                gap: 12,
              }}
            >
              <AddressAutocompleteField
                label="Search address"
                value={editingPlace.address || ''}
                onChange={(value) => setEditingPlace((prev) => ({ ...prev, address: value }))}
                onSelect={(place) => applyResolvedLocation(place, 'edit')}
                placeholder="Search for a new address or landmark"
              />
              <CoordinatePreview lat={editingPlace.lat} lon={editingPlace.lon} />
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)' }}>
              <Field label="Place name" icon={<Bookmark size={16} />}>
                <input
                  className="input-field"
                  value={editingPlace.name}
                  onChange={(e) => setEditingPlace((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Field>

              <Field label="Category" icon={<Tag size={16} />}>
                <select
                  className="input-field"
                  value={editingPlace.category}
                  onChange={(e) => setEditingPlace((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option[0].toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Field label="Latitude" icon={<Crosshair size={16} />}>
                <input
                  className="input-field"
                  value={editingPlace.lat}
                  onChange={(e) => setEditingPlace((prev) => ({ ...prev, lat: e.target.value }))}
                />
              </Field>
              <Field label="Longitude" icon={<Crosshair size={16} />}>
                <input
                  className="input-field"
                  value={editingPlace.lon}
                  onChange={(e) => setEditingPlace((prev) => ({ ...prev, lon: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Notes" icon={<StickyNote size={16} />}>
              <textarea
                className="input-field"
                value={editingPlace.notes || ''}
                onChange={(e) => setEditingPlace((prev) => ({ ...prev, notes: e.target.value }))}
                style={{ minHeight: 92, resize: 'vertical' }}
              />
            </Field>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <SaveIcon />
                Save Changes
              </button>
              <button type="button" onClick={() => handleUseCurrentLocation('edit')} style={secondaryButtonStyle}>
                <Crosshair className="w-4 h-4" />
                Use Current Location
              </button>
              <button type="button" onClick={() => setEditingPlace(null)} style={secondaryButtonStyle}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, icon, children }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: '#93c5fd' }}>{icon}</span>
        {label}
      </span>
      {children}
    </label>
  );
}

function CoordinatePreview({ lat, lon }) {
  if (!lat || !lon) {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--text-muted)',
          fontSize: 12,
        }}
      >
        No coordinates selected yet.
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 14,
        background: 'rgba(15,23,42,0.36)',
        border: '1px solid rgba(148,163,184,0.14)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        color: '#dbeafe',
        fontSize: 12,
      }}
    >
      <span><strong>Lat:</strong> {lat}</span>
      <span><strong>Lon:</strong> {lon}</span>
    </div>
  );
}

function AddressAutocompleteField({ label, value, onChange, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleInputChange = useCallback((event) => {
    const nextValue = event.target.value;
    onChange(nextValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (nextValue.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await geocodePlace(nextValue.trim());
        setSuggestions(res.data?.results || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [onChange]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Field label={label} icon={<MapPin size={16} />}>
        <div style={{ position: 'relative' }}>
          <input
            className="input-field"
            placeholder={placeholder}
            value={value}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            style={{ paddingRight: 40 }}
          />
          {loading && (
            <Loader2
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 16,
                height: 16,
                color: 'var(--blue)',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
        </div>
      </Field>

      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 6,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            zIndex: 80,
            overflow: 'hidden',
            boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
          }}
        >
          {suggestions.slice(0, 6).map((suggestion, index) => (
            <button
              key={`${suggestion.name}-${index}`}
              type="button"
              onClick={() => {
                onChange(suggestion.name);
                onSelect(suggestion);
                setShowSuggestions(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: index < Math.min(suggestions.length, 6) - 1 ? '1px solid var(--border)' : 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--text)',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(59,130,246,0.08)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              <MapPin size={15} style={{ marginTop: 2, color: '#93c5fd', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, lineHeight: 1.55 }}>{suggestion.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: 'rgba(15,23,42,0.28)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: '#cbd5e1' }}>{label}</div>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function getCategoryColor(category) {
  switch (category) {
    case 'home':
      return { bg: 'rgba(59,130,246,0.14)', text: '#93c5fd' };
    case 'work':
      return { bg: 'rgba(168,85,247,0.14)', text: '#d8b4fe' };
    case 'food':
      return { bg: 'rgba(251,146,60,0.14)', text: '#fdba74' };
    case 'scenic':
      return { bg: 'rgba(16,185,129,0.14)', text: '#6ee7b7' };
    case 'favorite':
      return { bg: 'rgba(244,114,182,0.14)', text: '#f9a8d4' };
    default:
      return { bg: 'rgba(148,163,184,0.14)', text: '#cbd5e1' };
  }
}

const secondaryButtonStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--panel-alt)',
  color: 'var(--text)',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

const dangerButtonStyle = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(244,63,94,0.35)',
  background: 'rgba(244,63,94,0.1)',
  color: '#fb7185',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

import React, { useState, useRef, useEffect } from 'react';
import usePWADetection from '../hooks/usePWADetection';
import useNotifications from '../hooks/useNotifications';

function Toggle({ label, enabled, onChange, disabled }) {
  return (
    <label className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
          ${enabled ? 'bg-indigo-600' : 'bg-gray-300'}
          disabled:opacity-50`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
            ${enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
        />
      </button>
    </label>
  );
}

export default function NotificationBell() {
  const isPWA = usePWADetection();
  const {
    isSupported,
    isSubscribed,
    preferences,
    initializing,
    busy,
    error,
    subscribe,
    unsubscribe,
    updatePreferences,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Only hide during initial mount check — never during actions
  if (!isPWA || !isSupported || initializing) return null;

  // When unsubscribed, render all toggles as off regardless of stored prefs
  const displayed = isSubscribed
    ? preferences
    : { notifyOnAdd: false, notifyOnRemove: false };
  const allOn = displayed.notifyOnAdd && displayed.notifyOnRemove;

  const handleTogglePref = async (key) => {
    // Not subscribed → user wants to opt in to just this category
    if (!isSubscribed) {
      await subscribe({
        notifyOnAdd: false,
        notifyOnRemove: false,
        [key]: true,
      });
      return;
    }

    const newValue = !preferences[key];
    const otherKey = key === 'notifyOnAdd' ? 'notifyOnRemove' : 'notifyOnAdd';

    // Turning this off would leave both off → unsubscribe entirely
    if (!newValue && !preferences[otherKey]) {
      await unsubscribe();
    } else {
      await updatePreferences({ [key]: newValue });
    }
  };

  const handleToggleAll = async () => {
    if (!isSubscribed) {
      // Subscribe with both on (DEFAULT_PREFS)
      await subscribe();
    } else if (allOn) {
      // All on → all off → unsubscribe
      await unsubscribe();
    } else {
      // Subscribed but some off → turn both on
      await updatePreferences({ notifyOnAdd: true, notifyOnRemove: true });
    }
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-14 right-0 bg-white rounded-xl shadow-xl p-4 w-64">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Notify me when…
          </p>

          <Toggle
            label="All"
            enabled={allOn}
            onChange={handleToggleAll}
            disabled={busy}
          />

          <div className="border-t border-gray-100 my-1" />

          <Toggle
            label="Item added"
            enabled={displayed.notifyOnAdd}
            onChange={() => handleTogglePref('notifyOnAdd')}
            disabled={busy}
          />
          <Toggle
            label="Item checked off"
            enabled={displayed.notifyOnRemove}
            onChange={() => handleTogglePref('notifyOnRemove')}
            disabled={busy}
          />

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      )}

      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center
          transition-all hover:scale-105
          ${isSubscribed
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-indigo-600 border-2 border-indigo-200'
          }`}
        aria-label="Notification settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      </button>
    </div>
  );
}
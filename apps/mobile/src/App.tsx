import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  ChevronLeft,
  Crosshair,
  LocateFixed,
  Moon,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  CITIES,
  getCity,
  getUVCategory,
  getUVSafetyMessage,
  localHour,
  summarizeForecast,
  type UVForecastResponse,
} from '@uv-alarm/shared';
import type {
  AccentPreference,
  BootstrapData,
  PermissionStatus,
  Settings,
  ThemePreference,
} from './models';
import { fetchForecast, sendTestPush } from './services/api';
import {
  createNotificationChannel,
  enableRemote,
  nearestForecastCity,
  notificationPermission,
  openNotificationSoundSettings,
  openNotificationSettings,
  preparePushListeners,
  requestNotificationPermission,
  scheduleForecastNotification,
  syncRemote,
  testLocalNotification,
  unregisterRemote,
} from './services/native';
import { resetStorage, saveForecast, saveSettings } from './services/storage';
import { applyTheme } from './services/theme';

const APP_VERSION = '1.0.0';
const ACCENTS: Array<{ id: AccentPreference; label: string }> = [
  { id: 'ocean', label: 'Ocean' },
  { id: 'lagoon', label: 'Lagoon' },
  { id: 'coral', label: 'Coral' },
  { id: 'sunset', label: 'Sunset' },
];

function formatUpdate(time?: string): string {
  if (!time) return 'No update yet';
  return new Intl.DateTimeFormat('en-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  }).format(new Date(time));
}

function currentPoint(forecast?: UVForecastResponse) {
  if (!forecast?.hourly.length) return undefined;
  const now = Date.now();
  return forecast.hourly.reduce((nearest, point) =>
    Math.abs(Date.parse(point.time) - now) < Math.abs(Date.parse(nearest.time) - now)
      ? point
      : nearest,
  );
}

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  return theme === 'light' ? (
    <Sun size={20} />
  ) : theme === 'dark' ? (
    <Moon size={20} />
  ) : (
    <span className="theme-system" aria-hidden>
      ◐
    </span>
  );
}

function Skeleton() {
  return (
    <div className="skeleton-stack" aria-label="Loading forecast">
      <div className="skeleton hero-skeleton" />
      <div className="skeleton alarm-skeleton" />
      <div className="skeleton hours-skeleton" />
    </div>
  );
}

function Onboarding({
  settings,
  onChange,
  onFinish,
  onEnable,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onFinish: () => void;
  onEnable: () => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const [enabling, setEnabling] = useState(false);
  const enable = async (): Promise<void> => {
    if (enabling) return;
    setEnabling(true);
    try {
      await onEnable();
    } finally {
      setEnabling(false);
    }
  };
  return (
    <main className="onboarding">
      <div className="brand-mark">
        <Sun size={26} />
        <span>UV Alarm</span>
      </div>
      <div className="onboarding-progress" aria-label={`Step ${page + 1} of 3`}>
        <span className={page >= 0 ? 'active' : ''} />
        <span className={page >= 1 ? 'active' : ''} />
        <span className={page >= 2 ? 'active' : ''} />
      </div>
      <section className="onboarding-card">
        {page === 0 && (
          <>
            <div className="step-icon">
              <LocateFixed />
            </div>
            <p className="eyebrow">Step 1 of 3</p>
            <h1>Choose your forecast</h1>
            <p>
              Pick the official IMS location closest to where you’ll be. You can change it anytime.
            </p>
            <label className="field-label" htmlFor="onboarding-city">
              Forecast location
            </label>
            <select
              id="onboarding-city"
              value={settings.cityId}
              onChange={(event) => onChange({ cityId: event.target.value })}
            >
              {CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </>
        )}
        {page === 1 && (
          <>
            <div className="step-icon">
              <ShieldAlert />
            </div>
            <p className="eyebrow">Step 2 of 3</p>
            <h1>Set your UV alert</h1>
            <p>Choose the UV level that matters to you. Higher UV needs stronger protection.</p>
            <div className="threshold-display">
              <span>Alert me at</span>
              <strong>UV {settings.threshold}+</strong>
            </div>
            <input
              className="threshold-range"
              aria-label="UV threshold"
              type="range"
              min="1"
              max="11"
              step="1"
              value={settings.threshold}
              onChange={(event) => onChange({ threshold: Number(event.target.value) })}
            />
            <div className="range-labels">
              <span>1</span>
              <span>6</span>
              <span>11+</span>
            </div>
          </>
        )}
        {page === 2 && (
          <>
            <div className="step-icon">
              <BellRing />
            </div>
            <p className="eyebrow">Step 3 of 3</p>
            <h1>Get a useful heads-up</h1>
            <p>
              UV Alarm can notify you when the forecast reaches your level. Android will ask
              permission only if you choose to enable it.
            </p>
            <button
              className="button primary wide"
              onClick={() => void enable()}
              disabled={enabling}
            >
              <Bell size={18} /> {enabling ? 'Enabling…' : 'Enable notifications'}
            </button>
            <button className="button text wide" onClick={onFinish} disabled={enabling}>
              Not now — view forecast
            </button>
          </>
        )}
        {page < 2 && (
          <button className="button primary wide next" onClick={() => setPage(page + 1)}>
            Continue
          </button>
        )}
        {page > 0 && page < 2 && (
          <button className="button text wide" onClick={() => setPage(page - 1)}>
            Back
          </button>
        )}
      </section>
      <p className="privacy-note">No account. No precise location stored.</p>
    </main>
  );
}

export default function App({ bootstrap }: { bootstrap: BootstrapData }) {
  const [settings, setSettings] = useState(bootstrap.settings);
  const [forecast, setForecast] = useState(bootstrap.cachedForecast);
  const [initialLoading, setInitialLoading] = useState(!bootstrap.cachedForecast);
  const [refreshing, setRefreshing] = useState(false);
  const [screen, setScreen] = useState<'main' | 'settings'>('main');
  const [permission, setPermission] = useState<PermissionStatus>('unknown');
  const [notice, setNotice] = useState<string>();
  const [locationNote, setLocationNote] = useState<string>();
  const [locationBusy, setLocationBusy] = useState(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const updateSettings = async (patch: Partial<Settings>, sync = true): Promise<Settings> => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next.theme, next.accent);
    await saveSettings(next);
    if (sync) syncRemote(next).catch(() => setNotice('Couldn’t register this device for alerts.'));
    if (forecast) void scheduleForecastNotification(forecast, next);
    return next;
  };

  const refresh = async (cityId = settings.cityId): Promise<void> => {
    if (forecast) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const next = await fetchForecast(cityId);
      setForecast(next);
      await saveForecast(next);
      await scheduleForecastNotification(next, { ...settings, cityId });
      if (next.source === 'fallback') setNotice('Official UV data is temporarily unavailable.');
      else if (next.source === 'unavailable') setNotice('Forecast is temporarily unavailable.');
      else setNotice(undefined);
    } catch {
      setNotice(
        forecast
          ? 'Couldn’t update the forecast. Showing the previous result.'
          : 'Couldn’t load the forecast. Check your connection and retry.',
      );
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void createNotificationChannel();
    void notificationPermission().then(setPermission);
    void preparePushListeners(
      (message) => setNotice(message),
      () => void syncRemote(settingsRef.current),
      () => setScreen('main'),
    );
    void refresh(settings.cityId);
    // Initial native setup should run once; user changes call refresh explicitly.
  }, []);

  const enableNotifications = async (): Promise<void> => {
    try {
      const status = await requestNotificationPermission();
      setPermission(status);
      if (status !== 'granted') {
        setNotice('Notifications are blocked in Android settings.');
        return;
      }

      const localPatch = { alarmEnabled: true, remoteEnabled: false };
      if (!settings.onboardingCompleted) {
        await finishOnboarding(localPatch);
        setNotice('On-device forecast alerts are enabled.');
        return;
      }

      await updateSettings(localPatch, false);
      await testLocalNotification(settings.threshold);
      setNotice('Notifications enabled on this device. A test alert is on its way.');

      try {
        const deviceId = await enableRemote({ ...settings, ...localPatch });
        await updateSettings(
          { ...localPatch, onboardingCompleted: true, remoteEnabled: true, deviceId },
          false,
        );
        setNotice('Notifications enabled. A test alert is on its way.');
      } catch {
        setNotice('On-device alerts are enabled. Remote alerts are not configured yet.');
      }
    } catch {
      setNotice('Couldn’t enable notifications. Check Android settings and try again.');
    }
  };

  const sendTestNotification = async (): Promise<void> => {
    if (settings.remoteEnabled)
      await sendTestPush(settings.installationId, settings.cityId, settings.threshold);
    else await testLocalNotification(settings.threshold);
  };

  const finishOnboarding = async (patch: Partial<Settings> = {}): Promise<void> => {
    const next = await updateSettings({ ...patch, onboardingCompleted: true }, false);
    setSettings(next);
    void refresh(next.cityId);
  };

  const chooseCity = async (cityId: string): Promise<void> => {
    await updateSettings({ cityId });
    void refresh(cityId);
  };

  const useLocation = async (): Promise<void> => {
    setLocationBusy(true);
    setLocationNote(undefined);
    try {
      const match = await nearestForecastCity();
      const city = getCity(match.cityId)!;
      setLocationNote(
        `Using ${city.name} forecast, approximately ${Math.round(match.distanceKm)} km away.`,
      );
      await chooseCity(match.cityId);
    } catch (error) {
      setLocationNote(
        error instanceof Error && error.message === 'permission-denied'
          ? 'Location permission was not granted.'
          : 'Couldn’t get your location. Check GPS and try again.',
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const point = currentPoint(forecast);
  const category = getUVCategory(point?.uv ?? 0);
  const summary = useMemo(
    () => (forecast ? summarizeForecast(forecast.hourly, settings.threshold) : undefined),
    [forecast, settings.threshold],
  );
  const cycleTheme = (): ThemePreference =>
    settings.theme === 'system' ? 'light' : settings.theme === 'light' ? 'dark' : 'system';

  if (!settings.onboardingCompleted)
    return (
      <Onboarding
        settings={settings}
        onChange={(patch) => void updateSettings(patch, false)}
        onFinish={() => void finishOnboarding()}
        onEnable={enableNotifications}
      />
    );

  if (screen === 'settings')
    return (
      <SettingsScreen
        settings={settings}
        forecast={forecast}
        permission={permission}
        locationNote={locationNote}
        locationBusy={locationBusy}
        onBack={() => setScreen('main')}
        onUpdate={(patch) => updateSettings(patch)}
        onCity={chooseCity}
        onLocation={useLocation}
        onEnable={enableNotifications}
        onTest={sendTestNotification}
        onNotice={setNotice}
      />
    );

  return (
    <div className="app-shell weather-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-sun">
            <Sun size={21} />
          </span>
          <span>UV Alarm</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Refresh forecast"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={20} className={refreshing ? 'spin' : ''} />
          </button>
          <button
            className="icon-button"
            aria-label={`Theme: ${settings.theme}`}
            onClick={() => void updateSettings({ theme: cycleTheme() }, false)}
          >
            <ThemeIcon theme={settings.theme} />
          </button>
          <button
            className="icon-button"
            aria-label="Open settings"
            onClick={() => setScreen('settings')}
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      <main className="content">
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice(undefined)}>
              <X size={17} />
            </button>
          </div>
        )}
        {initialLoading && !forecast ? (
          <Skeleton />
        ) : (
          <>
            <section className={`uv-card category-${category.toLowerCase().replace(' ', '-')}`}>
              <span className="weather-sun" aria-hidden />
              <span className="weather-wave wave-one" aria-hidden />
              <span className="weather-wave wave-two" aria-hidden />
              <div className="uv-card-top">
                <div>
                  <p className="city-name">
                    {forecast?.location.name ?? getCity(settings.cityId)?.name}
                  </p>
                  <p>{point ? `Forecast for ${localHour(point.time)}` : 'Forecast unavailable'}</p>
                </div>
                <span className="source-pill">
                  {forecast?.source === 'ims'
                    ? 'Official IMS'
                    : forecast?.source === 'fallback'
                      ? 'Temporary forecast'
                      : 'Unavailable'}
                </span>
              </div>
              <div className="uv-reading">
                <span className="uv-number">{point ? Math.round(point.uv) : '—'}</span>
                <div>
                  <span className="uv-label">UV index · now</span>
                  <strong>{category}</strong>
                </div>
              </div>
              <p className="safety-message">
                {point
                  ? getUVSafetyMessage(point.uv)
                  : 'Pull down a fresh forecast when your connection returns.'}
              </p>
              <div className="uv-meta">
                <span>Updated {formatUpdate(forecast?.updatedAt)}</span>
                {forecast?.stale && <span className="stale">Showing saved data</span>}
              </div>
            </section>

            <section className="card alarm-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR ALERT</p>
                  <h2>Alert me at UV</h2>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.alarmEnabled}
                  className={`switch ${settings.alarmEnabled ? 'on' : ''}`}
                  onClick={() => void updateSettings({ alarmEnabled: !settings.alarmEnabled })}
                >
                  <span />
                </button>
              </div>
              <div className="threshold-grid" role="group" aria-label="UV alert threshold">
                {Array.from({ length: 11 }, (_, index) => index + 1).map((value) => (
                  <button
                    key={value}
                    className={settings.threshold === value ? 'selected' : ''}
                    aria-pressed={settings.threshold === value}
                    onClick={() => void updateSettings({ threshold: value })}
                  >
                    {value}
                    {value === 11 ? '+' : ''}
                  </button>
                ))}
              </div>
              <div className="alarm-status">
                <Bell size={18} />
                <span>
                  {settings.alarmEnabled
                    ? `You’ll be alerted when UV reaches ${settings.threshold}.`
                    : 'UV alerts are paused.'}
                </span>
              </div>
              {permission !== 'granted' && (
                <button
                  className="button secondary wide"
                  onClick={() => void enableNotifications()}
                >
                  <BellRing size={18} /> Enable notifications
                </button>
              )}
              {permission === 'granted' && (
                <button
                  className="button text compact"
                  onClick={() =>
                    void sendTestNotification()
                      .then(() => setNotice('Test notification scheduled.'))
                      .catch(() => setNotice('Couldn’t send a test notification.'))
                  }
                >
                  Send a test notification
                </button>
              )}
            </section>

            <section className="forecast-section">
              <div className="section-title-row">
                <div>
                  <p className="eyebrow">TODAY</p>
                  <h2>Hourly forecast</h2>
                </div>
                {refreshing && (
                  <span className="refresh-label">
                    <RefreshCw size={14} className="spin" /> Updating
                  </span>
                )}
              </div>
              <div className="hour-strip">
                {summary?.today.length ? (
                  summary.today.map((hour) => {
                    const active = hour.uv >= settings.threshold;
                    const now = Math.abs(Date.parse(hour.time) - Date.now()) < 30 * 60_000;
                    return (
                      <div className={`hour-card ${active ? 'threshold-hit' : ''}`} key={hour.time}>
                        <span>{now ? 'Now' : localHour(hour.time)}</span>
                        <strong>{Math.round(hour.uv)}</strong>
                        <i
                          className={`dot category-${getUVCategory(hour.uv).toLowerCase().replace(' ', '-')}`}
                        />
                        <small>{getUVCategory(hour.uv)}</small>
                      </div>
                    );
                  })
                ) : (
                  <p className="empty-state">No hourly values are available.</p>
                )}
              </div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <span>Peak today</span>
                <strong>{summary?.peak ? `UV ${Math.round(summary.peak.uv)}` : '—'}</strong>
                <small>
                  {summary?.peak ? `at ${localHour(summary.peak.time)}` : 'Not available'}
                </small>
              </div>
              <div className="stat-card">
                <span>Reaches {settings.threshold}</span>
                <strong>
                  {summary?.threshold ? localHour(summary.threshold.time) : 'Not expected'}
                </strong>
                <small>
                  {summary?.below
                    ? `Below again at ${localHour(summary.below.time)}`
                    : summary?.threshold
                      ? 'Stays at or above today'
                      : 'today'}
                </small>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function SettingsScreen({
  settings,
  forecast,
  permission,
  locationNote,
  locationBusy,
  onBack,
  onUpdate,
  onCity,
  onLocation,
  onEnable,
  onTest,
  onNotice,
}: {
  settings: Settings;
  forecast?: UVForecastResponse;
  permission: PermissionStatus;
  locationNote?: string;
  locationBusy: boolean;
  onBack: () => void;
  onUpdate: (patch: Partial<Settings>) => Promise<Settings>;
  onCity: (id: string) => Promise<void>;
  onLocation: () => Promise<void>;
  onEnable: () => Promise<void>;
  onTest: () => Promise<void>;
  onNotice: (value: string) => void;
}) {
  const removeRegistration = async () => {
    try {
      await unregisterRemote(settings);
      await onUpdate({ remoteEnabled: false, deviceId: undefined });
      onNotice('Device registration removed.');
    } catch {
      onNotice('Couldn’t remove device registration.');
    }
  };
  const reset = async () => {
    if (!window.confirm('Reset all UV Alarm settings?')) return;
    try {
      await unregisterRemote(settings);
    } catch {
      /* Local reset can continue. */
    }
    await resetStorage();
    window.location.reload();
  };
  return (
    <div className="app-shell">
      <header className="app-header settings-header">
        <button className="icon-button" aria-label="Back" onClick={onBack}>
          <ChevronLeft />
        </button>
        <h1>Settings</h1>
        <span className="header-spacer" />
      </header>
      <main className="content settings-content">
        <section className="settings-group">
          <h2>Forecast location</h2>
          <label className="field-label" htmlFor="settings-city">
            IMS location
          </label>
          <select
            id="settings-city"
            value={settings.cityId}
            onChange={(event) => void onCity(event.target.value)}
          >
            {CITIES.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name} · {city.nameHebrew}
              </option>
            ))}
          </select>
          <button
            className="button secondary wide"
            disabled={locationBusy}
            onClick={() => void onLocation()}
          >
            <Crosshair size={18} /> {locationBusy ? 'Finding nearest forecast…' : 'Use my location'}
          </button>
          <p className="help">
            Your current coordinates are used once to find the nearest location, then discarded.
          </p>
          {locationNote && (
            <p className="inline-status">
              {locationNote}{' '}
              <button className="link-button" onClick={() => void onLocation()}>
                Retry
              </button>
            </p>
          )}
        </section>
        <section className="settings-group">
          <h2>Alert settings</h2>
          <div className="setting-row">
            <div>
              <strong>Alarm enabled</strong>
              <small>Highlight and schedule your selected level</small>
            </div>
            <button
              role="switch"
              aria-checked={settings.alarmEnabled}
              className={`switch ${settings.alarmEnabled ? 'on' : ''}`}
              onClick={() => void onUpdate({ alarmEnabled: !settings.alarmEnabled })}
            >
              <span />
            </button>
          </div>
          <label className="field-label" htmlFor="settings-threshold">
            UV threshold
          </label>
          <select
            id="settings-threshold"
            value={settings.threshold}
            onChange={(event) => void onUpdate({ threshold: Number(event.target.value) })}
          >
            {Array.from({ length: 11 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                UV {value}
                {value === 11 ? '+' : ''}
              </option>
            ))}
          </select>
        </section>
        <section className="settings-group">
          <h2>Notifications</h2>
          <div className="status-row">
            <span className={`status-dot ${permission}`} />
            <div>
              <strong>
                {permission === 'granted'
                  ? 'Notifications enabled'
                  : permission === 'denied'
                    ? 'Notifications blocked in Android settings'
                    : permission === 'unavailable'
                      ? 'Notifications unavailable'
                      : 'Permission not requested'}
              </strong>
              <small>
                {settings.remoteEnabled ? 'Remote UV alerts registered' : 'In-app alerts only'}
              </small>
            </div>
          </div>
          {permission !== 'granted' && (
            <button className="button primary wide" onClick={() => void onEnable()}>
              Enable notifications
            </button>
          )}
          {permission === 'denied' && (
            <button
              className="button secondary wide"
              onClick={() => void openNotificationSettings()}
            >
              Open Android settings
            </button>
          )}
          {permission === 'granted' && (
            <>
              {!settings.remoteEnabled && (
                <button className="button primary wide" onClick={() => void onEnable()}>
                  Enable remote alerts
                </button>
              )}
              <button
                className="button secondary wide"
                onClick={() =>
                  void onTest()
                    .then(() =>
                      onNotice(
                        settings.remoteEnabled
                          ? 'Remote test notification sent.'
                          : 'Test notification scheduled.',
                      ),
                    )
                    .catch(() => onNotice('Couldn’t send a test notification.'))
                }
              >
                {settings.remoteEnabled ? 'Test remote notification' : 'Test local notification'}
              </button>
            </>
          )}
          <div className="notification-sound-row">
            <div>
              <strong>Notification sound</strong>
              <small>System default unless you choose another Android sound</small>
            </div>
            <button
              className="button secondary"
              onClick={() => void openNotificationSoundSettings()}
            >
              Choose sound
            </button>
          </div>
          {settings.remoteEnabled && (
            <button className="button text danger wide" onClick={() => void removeRegistration()}>
              <Trash2 size={17} /> Remove device registration
            </button>
          )}
        </section>
        <section className="settings-group">
          <h2>Appearance</h2>
          <div className="segmented" role="group" aria-label="Theme">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                className={settings.theme === theme ? 'active' : ''}
                aria-pressed={settings.theme === theme}
                key={theme}
                onClick={() => void onUpdate({ theme })}
              >
                {theme[0]!.toUpperCase() + theme.slice(1)}
              </button>
            ))}
          </div>
          <label className="field-label">App color</label>
          <div className="accent-grid" role="group" aria-label="App color">
            {ACCENTS.map((accent) => (
              <button
                key={accent.id}
                className={`accent-choice accent-${accent.id} ${settings.accent === accent.id ? 'active' : ''}`}
                aria-pressed={settings.accent === accent.id}
                onClick={() => void onUpdate({ accent: accent.id })}
              >
                <span className="accent-swatch" />
                {accent.label}
              </button>
            ))}
          </div>
        </section>
        <section className="settings-group">
          <h2>Data & app</h2>
          <div className="detail-list">
            <div>
              <span>Data source</span>
              <strong>
                {forecast?.source === 'ims'
                  ? 'Official IMS'
                  : forecast?.source === 'fallback'
                    ? 'Temporary fallback'
                    : 'Unavailable'}
              </strong>
            </div>
            <div>
              <span>Last refresh</span>
              <strong>{formatUpdate(forecast?.updatedAt)}</strong>
            </div>
            <div>
              <span>App version</span>
              <strong>{APP_VERSION}</strong>
            </div>
          </div>
          <button className="button text danger wide" onClick={() => void reset()}>
            Reset app settings
          </button>
        </section>
        <p className="settings-footer">
          UV Alarm stores your city, threshold, color, theme, and a random installation ID. It never
          stores your precise GPS location.
        </p>
      </main>
    </div>
  );
}

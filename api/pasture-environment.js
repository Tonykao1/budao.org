module.exports = async function handler(req, res) {
  try {
    const q = req.query || {};
    const n = v => {
      const x = Number(v);
      return Number.isFinite(x) ? x : null;
    };

    let lat = n(q.lat);
    let lon = n(q.lon);
    let source = 'browser';

    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      lat = n(req.headers['x-vercel-ip-latitude']);
      lon = n(req.headers['x-vercel-ip-longitude']);
      source = 'ip';
    }

    // Last-resort neutral fallback. Normally Vercel supplies IP geolocation.
    if (lat === null || lon === null) {
      lat = 39.9042;
      lon = 116.4074;
      source = 'fallback';
    }

    const cityHeader = req.headers['x-vercel-ip-city'];
    let city = '';
    if (cityHeader) {
      try { city = decodeURIComponent(String(cityHeader)); }
      catch { city = String(cityHeader); }
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', [
      'temperature_2m',
      'weather_code',
      'cloud_cover',
      'precipitation',
      'rain',
      'snowfall',
      'wind_speed_10m',
      'is_day'
    ].join(','));
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('past_days', '1');
    url.searchParams.set('forecast_days', '2');

    const weatherRes = await fetch(url, {
      headers: { 'user-agent': 'budao-pasture-environment/1.0' }
    });
    if (!weatherRes.ok) throw new Error('weather upstream ' + weatherRes.status);
    const data = await weatherRes.json();

    const offset = Number(data.utc_offset_seconds || 0);
    const localIsoToEpoch = value => {
      if (!value) return null;
      const t = Date.parse(value + 'Z');
      return Number.isFinite(t) ? t - offset * 1000 : null;
    };

    const sunsetYesterday = localIsoToEpoch(data.daily?.sunset?.[0]);
    const sunriseToday = localIsoToEpoch(data.daily?.sunrise?.[1]);
    const sunsetToday = localIsoToEpoch(data.daily?.sunset?.[1]);
    const sunriseTomorrow = localIsoToEpoch(data.daily?.sunrise?.[2]);

    const now = Date.now();
    const synodic = 29.53058867;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const days = (now - knownNewMoon) / 86400000;
    const phase = ((days / synodic) % 1 + 1) % 1;
    const moonAgeDays = phase * synodic;

    const payload = {
      ok: true,
      source,
      location: {
        latitude: lat,
        longitude: lon,
        city,
        timezone: data.timezone || req.headers['x-vercel-ip-timezone'] || 'UTC',
        timezoneAbbreviation: data.timezone_abbreviation || '',
        utcOffsetSeconds: offset
      },
      current: {
        observedAt: now,
        temperatureC: data.current?.temperature_2m ?? null,
        weatherCode: data.current?.weather_code ?? 0,
        cloudCover: data.current?.cloud_cover ?? 0,
        precipitationMm: data.current?.precipitation ?? 0,
        rainMm: data.current?.rain ?? 0,
        snowfallCm: data.current?.snowfall ?? 0,
        windKmh: data.current?.wind_speed_10m ?? 0,
        isDay: data.current?.is_day === 1
      },
      astronomy: {
        sunsetYesterday,
        sunriseToday,
        sunsetToday,
        sunriseTomorrow,
        moonPhase: phase,
        moonAgeDays
      }
    };

    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1800');
    res.status(200).json(payload);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: 'environment_unavailable' });
  }
};

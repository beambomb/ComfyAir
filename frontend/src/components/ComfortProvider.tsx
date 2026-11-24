"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  AC_POWER_OPTIONS,
  DEFAULT_MODE,
  ENERGY,
  HUMIDITY,
  OUTDOOR,
  clampOutdoor,
  snapHumidity,
  type Mode,
} from "@/lib/comfort";
import { DEFAULT_CITY, findCity } from "@/lib/cities";
import { DEFAULT_SLEEP_PROFILE, type SleepProfileConfig } from "@/lib/night";
import {
  WS_TELEMETRY_URL,
  fetchBackendWeather,
  fetchHealth,
  fetchMe,
  fetchPreferences,
  fetchSleepProfile,
  type UserProfile,
} from "@/lib/api";
import { fetchWeatherSnapshot, type HourlyPoint } from "@/lib/weather";

export const AUTH_STORAGE_KEY = "comfyair_auth";

export type WeatherState =
  | { status: "loading" }
  | {
      status: "live";
      city: string;
      temp: number;
      humidity: number;
      observedAt: string;
      hourly: HourlyPoint[];
    }
  | { status: "sample" };

export type Controls = {
  outdoorTemp: number;
  humidity: number;
  mode: Mode;
  power: boolean;
  acPowerKw: number;
  tariffPerKwh: number;
  hoursPerNight: number;
  touched: boolean;
};

export type AuthState = {
  status: "guest" | "authenticated";
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export type ComfortState = {
  city: string;
  weather: WeatherState;
  controls: Controls;
  sleepProfile: SleepProfileConfig;
  auth: AuthState;
  wsConnected: boolean;
};

export type ComfortAction =
  | { type: "city/set"; city: string }
  | { type: "weather/loading" }
  | {
      type: "weather/live";
      city: string;
      temp: number;
      humidity: number;
      observedAt: string;
      hourly: HourlyPoint[];
    }
  | { type: "weather/sample" }
  | { type: "weather/reset" }
  | { type: "temp/step"; delta: 1 | -1 }
  | { type: "humidity/step"; delta: 5 | -5 }
  | { type: "mode/set"; mode: Mode }
  | { type: "power/toggle" }
  | { type: "acPower/set"; value: number }
  | { type: "tariff/set"; value: number }
  | { type: "hours/set"; value: number }
  | { type: "sleepProfile/set"; patch: Partial<SleepProfileConfig> }
  | { type: "auth/login"; user: UserProfile; accessToken: string; refreshToken: string }
  | { type: "auth/logout" }
  | { type: "ws/set"; connected: boolean };

const initialState: ComfortState = {
  city: DEFAULT_CITY,
  weather: { status: "loading" },
  controls: {
    outdoorTemp: OUTDOOR.sample,
    humidity: HUMIDITY.sample,
    mode: DEFAULT_MODE,
    power: true,
    acPowerKw: ENERGY.acPowerKw,
    tariffPerKwh: ENERGY.tariffPerKwh,
    hoursPerNight: ENERGY.hoursPerNight,
    touched: false,
  },
  sleepProfile: DEFAULT_SLEEP_PROFILE,
  auth: {
    status: "guest",
    user: null,
    accessToken: null,
    refreshToken: null,
  },
  wsConnected: false,
};

function clampTo(value: number, bounds: { min: number; max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function pkToKw(pk: number): number {
  const match = AC_POWER_OPTIONS.find((o) => Math.abs(o.pk - pk) < 0.05);
  return match ? match.kw : Math.round(pk * 0.8 * 100) / 100;
}

export function kwToPk(kw: number): number {
  const match = AC_POWER_OPTIONS.find((o) => Math.abs(o.kw - kw) < 0.05);
  return match ? match.pk : Math.round((kw / 0.8) * 100) / 100;
}

function reducer(state: ComfortState, action: ComfortAction): ComfortState {
  const { controls } = state;
  switch (action.type) {
    case "city/set":
      return {
        ...state,
        city: action.city,
        weather: { status: "loading" },
        controls: { ...controls, touched: false },
      };
    case "weather/loading":
      return { ...state, weather: { status: "loading" } };
    case "weather/live": {
      const weather: WeatherState = {
        status: "live",
        city: action.city,
        temp: action.temp,
        humidity: action.humidity,
        observedAt: action.observedAt,
        hourly: action.hourly,
      };
      if (controls.touched) return { ...state, weather };
      return {
        ...state,
        weather,
        controls: {
          ...controls,
          outdoorTemp: clampOutdoor(action.temp),
          humidity: snapHumidity(action.humidity),
        },
      };
    }
    case "weather/sample":
      return { ...state, weather: { status: "sample" } };
    case "weather/reset":
      if (state.weather.status === "live") {
        return {
          ...state,
          controls: {
            ...controls,
            outdoorTemp: clampOutdoor(state.weather.temp),
            humidity: snapHumidity(state.weather.humidity),
            touched: false,
          },
        };
      }
      return {
        ...state,
        controls: {
          ...controls,
          outdoorTemp: OUTDOOR.sample,
          humidity: HUMIDITY.sample,
          touched: false,
        },
      };
    case "temp/step":
      return {
        ...state,
        controls: {
          ...controls,
          outdoorTemp: clampTo(controls.outdoorTemp + action.delta, OUTDOOR),
          touched: true,
        },
      };
    case "humidity/step":
      return {
        ...state,
        controls: {
          ...controls,
          humidity: clampTo(controls.humidity + action.delta, HUMIDITY),
          touched: true,
        },
      };
    case "mode/set":
      return { ...state, controls: { ...controls, mode: action.mode } };
    case "power/toggle":
      return { ...state, controls: { ...controls, power: !controls.power } };
    case "acPower/set":
      return { ...state, controls: { ...controls, acPowerKw: action.value } };
    case "tariff/set":
      return { ...state, controls: { ...controls, tariffPerKwh: action.value } };
    case "hours/set":
      return { ...state, controls: { ...controls, hoursPerNight: action.value } };
    case "sleepProfile/set":
      return { ...state, sleepProfile: { ...state.sleepProfile, ...action.patch } };
    case "auth/login":
      return {
        ...state,
        auth: {
          status: "authenticated",
          user: action.user,
          accessToken: action.accessToken,
          refreshToken: action.refreshToken,
        },
      };
    case "auth/logout":
      return {
        ...state,
        auth: {
          status: "guest",
          user: null,
          accessToken: null,
          refreshToken: null,
        },
      };
    case "ws/set":
      return { ...state, wsConnected: action.connected };
  }
}

const StateContext = createContext<ComfortState | null>(null);
const DispatchContext = createContext<Dispatch<ComfortAction> | null>(null);

export function ComfortProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Fetch weather whenever active city changes (backend cache first, direct Open-Meteo fallback).
  useEffect(() => {
    const controller = new AbortController();
    const cityInfo = findCity(state.city);

    fetchBackendWeather(cityInfo.name, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "weather/live",
          city: res.city,
          temp: res.temp,
          humidity: res.humidity,
          observedAt: res.observed_at,
          hourly: res.hourly,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        fetchWeatherSnapshot(controller.signal, cityInfo)
          .then((snap) => {
            if (controller.signal.aborted) return;
            dispatch({
              type: "weather/live",
              city: snap.city,
              temp: snap.temp,
              humidity: snap.humidity,
              observedAt: snap.observedAt,
              hourly: snap.hourly,
            });
          })
          .catch(() => {
            if (!controller.signal.aborted) dispatch({ type: "weather/sample" });
          });
      });

    return () => controller.abort();
  }, [state.city]);

  // Restore saved session from localStorage and hydrate backend preferences / sleep profile.
  useEffect(() => {
    let active = true;
    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { accessToken?: string; refreshToken?: string };
      const access = parsed.accessToken;
      const refresh = parsed.refreshToken || "";
      if (!access) return;

      fetchMe(access)
        .then(async (user) => {
          if (!active) return;
          dispatch({ type: "auth/login", user, accessToken: access, refreshToken: refresh });
          const [pref, sp] = await Promise.all([
            fetchPreferences(access).catch(() => null),
            fetchSleepProfile(access).catch(() => null),
          ]);
          if (!active) return;
          if (pref) {
            dispatch({ type: "acPower/set", value: pkToKw(pref.ac_power_pk) });
            dispatch({ type: "tariff/set", value: pref.electricity_rate_per_kwh });
            if (pref.preferred_city) dispatch({ type: "city/set", city: pref.preferred_city });
          }
          if (sp) {
            dispatch({
              type: "sleepProfile/set",
              patch: {
                bedtime: sp.bedtime.slice(0, 5),
                wakeTime: sp.wake_time.slice(0, 5),
                startTemp: sp.start_temp,
                deepSleepTemp: sp.deep_sleep_temp,
                wakeTemp: sp.wake_temp,
                isActive: sp.is_active,
              },
            });
          }
        })
        .catch(() => {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        });
    } catch {
      // Ignore malformed localStorage entries.
    }
    return () => {
      active = false;
    };
  }, []);

  // Connect WebSocket telemetry only when backend health endpoint is reachable.
  useEffect(() => {
    let socket: WebSocket | null = null;
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then(() => {
        if (controller.signal.aborted) return;
        socket = new WebSocket(WS_TELEMETRY_URL);
        socket.onopen = () => dispatch({ type: "ws/set", connected: true });
        socket.onclose = () => dispatch({ type: "ws/set", connected: false });
        socket.onerror = () => dispatch({ type: "ws/set", connected: false });
      })
      .catch(() => {
        dispatch({ type: "ws/set", connected: false });
      });

    return () => {
      controller.abort();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useComfortState(): ComfortState {
  const state = useContext(StateContext);
  if (!state) throw new Error("useComfortState must be used inside <ComfortProvider>");
  return state;
}

export function useComfortDispatch(): Dispatch<ComfortAction> {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("useComfortDispatch must be used inside <ComfortProvider>");
  return dispatch;
}

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
import {
  WS_TELEMETRY_URL,
  fetchBackendWeather,
  fetchHealth,
  fetchMe,
  fetchPreferences,
  type UserProfile,
} from "@/lib/api";
import { fetchWeatherSnapshot } from "@/lib/weather";

export const AUTH_STORAGE_KEY = "comfyair_auth";

export type WeatherState =
  | { status: "loading" }
  | {
      status: "live";
      city: string;
      temp: number;
      humidity: number;
      observedAt: string;
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
  auth: AuthState;
  wsConnected: boolean;
  feedbackVersion: number;
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
  | { type: "auth/login"; user: UserProfile; accessToken: string; refreshToken: string }
  | { type: "auth/logout" }
  | { type: "ws/set"; connected: boolean }
  | { type: "feedback/bump" };

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
  auth: {
    status: "guest",
    user: null,
    accessToken: null,
    refreshToken: null,
  },
  wsConnected: false,
  feedbackVersion: 0,
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
    case "auth/login":
      return {
        ...state,
        auth: {
          status: "authenticated",
          user: action.user,
          accessToken: action.accessToken,
          refreshToken: action.refreshToken,
        },
        feedbackVersion: state.feedbackVersion + 1,
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
        feedbackVersion: state.feedbackVersion + 1,
      };
    case "ws/set":
      return { ...state, wsConnected: action.connected };
    case "feedback/bump":
      return { ...state, feedbackVersion: state.feedbackVersion + 1 };
  }
}

const StateContext = createContext<ComfortState | null>(null);
const DispatchContext = createContext<Dispatch<ComfortAction> | null>(null);

export function ComfortProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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
            });
          })
          .catch(() => {
            if (!controller.signal.aborted) dispatch({ type: "weather/sample" });
          });
      });

    return () => controller.abort();
  }, [state.city]);

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
          const pref = await fetchPreferences(access).catch(() => null);
          if (!active || !pref) return;
          dispatch({ type: "acPower/set", value: pkToKw(pref.ac_power_pk) });
          dispatch({ type: "tariff/set", value: pref.electricity_rate_per_kwh });
          if (pref.preferred_city) dispatch({ type: "city/set", city: pref.preferred_city });
        })
        .catch(() => {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        });
    } catch {
      // Ignore malformed storage data.
    }
    return () => {
      active = false;
    };
  }, []);

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

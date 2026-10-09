"use client";

import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import {
  clampOutdoor,
  DEFAULT_MODE,
  HUMIDITY,
  nextMode,
  OUTDOOR,
  snapHumidity,
  type Mode,
} from "@/lib/comfort";
import { fetchWeatherSnapshot, type HourlyPoint } from "@/lib/weather";

export type WeatherState =
  | { status: "loading" }
  | {
      status: "live";
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
  /** True once the visitor changed a number; live weather no longer overwrites it. */
  touched: boolean;
};

export type ComfortState = { weather: WeatherState; controls: Controls };

export type ComfortAction =
  | { type: "weather/live"; temp: number; humidity: number; observedAt: string; hourly: HourlyPoint[] }
  | { type: "weather/sample" }
  | { type: "temp/step"; delta: 1 | -1 }
  | { type: "humidity/step"; delta: 5 | -5 }
  | { type: "mode/set"; mode: Mode }
  | { type: "mode/cycle" }
  | { type: "power/toggle" };

const initialState: ComfortState = {
  weather: { status: "loading" },
  controls: {
    outdoorTemp: OUTDOOR.sample,
    humidity: HUMIDITY.sample,
    mode: DEFAULT_MODE,
    power: true,
    touched: false,
  },
};

function clampTo(value: number, bounds: { min: number; max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

function reducer(state: ComfortState, action: ComfortAction): ComfortState {
  const { controls } = state;
  switch (action.type) {
    case "weather/live": {
      const weather: WeatherState = {
        status: "live",
        temp: action.temp,
        humidity: action.humidity,
        observedAt: action.observedAt,
        hourly: action.hourly,
      };
      if (controls.touched) return { ...state, weather };
      return {
        weather,
        controls: {
          ...controls,
          outdoorTemp: clampOutdoor(action.temp),
          humidity: snapHumidity(action.humidity),
        },
      };
    }
    case "weather/sample":
      // Controls already hold the sample values (30 C, 75 %).
      return { ...state, weather: { status: "sample" } };
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
    case "mode/cycle":
      return { ...state, controls: { ...controls, mode: nextMode(controls.mode) } };
    case "power/toggle":
      return { ...state, controls: { ...controls, power: !controls.power } };
  }
}

const StateContext = createContext<ComfortState | null>(null);
const DispatchContext = createContext<Dispatch<ComfortAction> | null>(null);

export function ComfortProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Live weather once per visit. Runs only in the browser, never at build time.
  useEffect(() => {
    const controller = new AbortController();
    fetchWeatherSnapshot(controller.signal)
      .then((weather) => dispatch({ type: "weather/live", ...weather }))
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "weather/sample" });
      });
    return () => controller.abort();
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

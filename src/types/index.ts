import * as d3 from "d3";
import Moment from "moment";

export interface CovidDataPoint {
  Date_of_report: string;
  Municipality_code: string;
  Total_reported: number;
  Daily_Total_reported?: number;
  Daily_Total_reported_ma?: number;
}

export interface PopulationDataPoint {
  Regions: string;
  PopulationOn31December_20: number;
  PopulationOn1January_1: number;
}

export interface DayData {
  date: Moment.Moment;
  data: Record<string, number>;
}

export interface GeoJsonFeature {
  properties: {
    areaCode: number;
    areaName: string;
  };
}

export interface GeoJson {
  type: string;
  features: GeoJsonFeature[];
}

export interface LoadedData {
  nlGeoJson: GeoJson;
  covidDataGroupedByDay: DayData[];
  colorScale: d3.ScaleLinear<number, string>;
  numberOfDays: number;
  sliderMarks: Array<{ value: number; label: string }>;
}

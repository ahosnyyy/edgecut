import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../auth/apiClient";

export interface StockShortfall {
  system: string;
  profileType: string;
  demandLength: number;
  availableLength: number;
  deficitLength: number;
}

export interface DemandCombo {
  system: string;
  profileType: string;
  demandLength: number;
  availableLength: number;
  covered: boolean;
  deficitBars: number;
  barLength: number;
}

export interface StockCoverage {
  hasData: boolean;
  coveragePct: number;
  totalCombos: number;
  coveredCombos: number;
  demandLength: number;
  shortfalls: StockShortfall[];
  demandBreakdown: DemandCombo[];
}

export function useStockCoverage() {
  return useQuery<StockCoverage>({
    queryKey: ["dashboard", "stock-coverage"],
    queryFn: () => apiFetch<StockCoverage>("/api/dashboard/stock-coverage"),
  });
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { RulerIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import { useSettings, type UnitKey, type MeasurementSystem } from "../hooks/useSettings";
import { UNITS, MEASUREMENT_SYSTEMS } from "../engine/units";

export default function Settings() {
  const { displayUnit, measurementSystem, setDisplayUnit, setMeasurementSystem, kerfWidth, setKerfWidth, optimizationStrategy, setOptimizationStrategy, fromMM, toMM } = useSettings();

  const [kerfDisplay, setKerfDisplay] = useState("");

  useEffect(() => {
    setKerfDisplay(String(fromMM(kerfWidth)));
  }, [kerfWidth, fromMM]);

  const metricUnits = Object.entries(UNITS).filter(([, u]) => u.system === "metric");
  const imperialUnits = Object.entries(UNITS).filter(([, u]) => u.system === "imperial");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-lg flex flex-col gap-4">

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={RulerIcon} size={16} className="text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Measurement Units</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Choose how lengths are displayed across the app. Internal calculations always use millimeters.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Measurement System</Label>
                  <Select
                    value={measurementSystem}
                    onValueChange={(v) => setMeasurementSystem(v as MeasurementSystem)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value) => MEASUREMENT_SYSTEMS[value as MeasurementSystem]?.label ?? value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEASUREMENT_SYSTEMS).map(([key, sys]) => (
                        <SelectItem key={key} value={key}>
                          {sys.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Display Unit</Label>
                  <Select
                    value={displayUnit}
                    onValueChange={(v) => setDisplayUnit(v as UnitKey)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(value) => {
                          const u = UNITS[value as UnitKey];
                          return u ? `${u.fullName} (${u.label})` : value;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {metricUnits.map(([key, u]) => (
                        <SelectItem key={key} value={key}>
                          {u.fullName} ({u.label})
                        </SelectItem>
                      ))}
                      {imperialUnits.map(([key, u]) => (
                        <SelectItem key={key} value={key}>
                          {u.fullName} ({u.label})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Settings01Icon} size={16} className="text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Optimization Defaults</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Default kerf width and optimization goal for new projects. Individual projects can override these.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-4">
                <div className="flex flex-col gap-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Kerf Width ({UNITS[displayUnit].label})</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={kerfDisplay}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setKerfDisplay(raw);
                      const val = parseFloat(raw);
                      if (!isNaN(val) && val >= 0) {
                        setKerfWidth(toMM(val));
                      }
                    }}
                    onBlur={() => {
                      const val = parseFloat(kerfDisplay);
                      if (isNaN(val) || val < 0) {
                        setKerfDisplay(String(fromMM(5)));
                        setKerfWidth(5);
                      }
                    }}
                    className="font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  <Label className="text-xs text-muted-foreground">Optimization Goal</Label>
                  <Select
                    value={optimizationStrategy}
                    onValueChange={(v) => setOptimizationStrategy(v as "balanced" | "maximize_large_bars")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {optimizationStrategy === "maximize_large_bars" ? "Maximize Large Bars" : "Balanced"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maximize_large_bars">Maximize Large Bars</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {optimizationStrategy === "maximize_large_bars"
                      ? "Fills large bars to capacity first, leaving long clean cutoffs."
                      : "Spreads cuts to tightly pack smaller bars first."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}

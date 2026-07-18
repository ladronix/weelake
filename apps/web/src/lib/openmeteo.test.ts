import { describe, expect, it } from "vitest";
import { conditionFromCode } from "./openmeteo";

describe("conditionFromCode", () => {
  const cases: Array<[number, string]> = [
    [0, "Clear"],
    [1, "Mainly clear"],
    [2, "Mainly clear"],
    [3, "Cloudy"],
    [45, "Fog"],
    [51, "Drizzle"],
    [63, "Rain"],
    [71, "Snow"],
    [80, "Showers"],
    [95, "Thunderstorm"],
    [96, "Thunderstorm w/ hail"],
    [999, "—"],
  ];

  it.each(cases)("code %i → %s", (code, label) => {
    expect(conditionFromCode(code)).toBe(label);
  });
});

import { describe, expect, test } from "bun:test";
import { discountPercent, effectivePrice, hasDiscount, validateProductPricing } from "./format";

describe("product pricing rules", () => {
  test("equal sale and regular prices are valid and not discounted", () => {
    expect(validateProductPricing(2000, 2000, false)).toBeNull();
    expect(hasDiscount(2000, 2000)).toBe(false);
    expect(discountPercent(2000, 2000)).toBeNull();
    expect(effectivePrice({ price: 2000, discounted_price: 2000, is_free: false })).toBe(2000);
  });
  test("negative sale prices remain invalid", () => {
    expect(validateProductPricing(2000, -1, false)).not.toBeNull();
  });
  test("sale prices above regular prices remain invalid", () => {
    expect(validateProductPricing(2000, 2001, false)).not.toBeNull();
  });
  test("nonfinite prices remain invalid", () => {
    expect(validateProductPricing(Infinity, 2000, false)).not.toBeNull();
    expect(validateProductPricing(2000, NaN, false)).not.toBeNull();
  });
  test("paid products still require a positive regular price", () => {
    expect(validateProductPricing(0, null, false)).not.toBeNull();
    expect(validateProductPricing(-1, null, false)).not.toBeNull();
  });
  test("ordinary discounts retain their percentage", () => {
    expect(validateProductPricing(80, 40, false)).toBeNull();
    expect(hasDiscount(80, 40)).toBe(true);
    expect(discountPercent(80, 40)).toBe(50);
  });
  test("small genuine discounts never return the renderable zero", () => {
    expect(hasDiscount(2000, 1999)).toBe(true);
    expect(discountPercent(2000, 1999)).toBe(0.05);
  });
  test("zero sale price is valid and used consistently", () => {
    expect(validateProductPricing(2000, 0, false)).toBeNull();
    expect(discountPercent(2000, 0)).toBe(100);
    expect(effectivePrice({ price: 2000, discounted_price: 0, is_free: false })).toBe(0);
  });
  test("missing sale price is not discounted", () => {
    expect(discountPercent(2000, null)).toBeNull();
    expect(effectivePrice({ price: "2000", discounted_price: null, is_free: false })).toBe(2000);
  });
  test("free products keep their pricing exemption", () => {
    expect(validateProductPricing(0, null, true)).toBeNull();
    expect(effectivePrice({ price: 2000, discounted_price: 1000, is_free: true })).toBe(0);
  });
});
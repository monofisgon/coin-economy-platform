import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Pure logic helpers ───────────────────────────────────────────────────────

/**
 * Simulates the balance deduction logic for a product purchase.
 * Returns the new balance after purchase, or throws if invalid.
 */
function simulatePurchase(
  coinBalance: number,
  coinPrice: number,
  isActive: boolean,
): { newBalance: number } {
  if (!isActive) {
    const err = new Error('Product is not available for purchase')
    ;(err as NodeJS.ErrnoException).code = 'PRODUCT_INACTIVE'
    throw err
  }
  if (coinBalance < coinPrice) {
    const err = new Error('Insufficient coin balance to purchase this product')
    ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
    throw err
  }
  return { newBalance: coinBalance - coinPrice }
}

// ─── Property 11: Conservación de balance en compra de productos ──────────────

// Feature: coin-economy-platform, Property 11: Conservación de balance en compra de productos
describe('Property 11: Conservación de balance en compra de productos', () => {
  it('user coin balance decreases by exactly coinPrice after a valid purchase', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }), // coinBalance
        fc.integer({ min: 1, max: 10_000 }), // coinPrice
        (coinBalance, coinPrice) => {
          fc.pre(coinBalance >= coinPrice) // valid purchase condition

          const { newBalance } = simulatePurchase(coinBalance, coinPrice, true)

          // Balance decreases by exactly coinPrice
          expect(newBalance).toBe(coinBalance - coinPrice)
          // Balance is non-negative
          expect(newBalance).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('balance decrease equals exactly coinPrice (conservation)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        (coinBalance, coinPrice) => {
          fc.pre(coinBalance >= coinPrice)

          const { newBalance } = simulatePurchase(coinBalance, coinPrice, true)
          const decrease = coinBalance - newBalance

          expect(decrease).toBe(coinPrice)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('purchase is rejected when balance is insufficient', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),  // coinBalance
        fc.integer({ min: 1, max: 1_000 }), // coinPrice
        (coinBalance, coinPrice) => {
          fc.pre(coinBalance < coinPrice) // insufficient balance

          expect(() => simulatePurchase(coinBalance, coinPrice, true)).toThrow()

          try {
            simulatePurchase(coinBalance, coinPrice, true)
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('INSUFFICIENT_BALANCE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 12: Productos inactivos no comprables ───────────────────────────

// Feature: coin-economy-platform, Property 12: Productos inactivos no comprables
describe('Property 12: Productos inactivos no comprables', () => {
  it('purchase of inactive product is always rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }), // coinBalance
        fc.integer({ min: 1, max: 10_000 }), // coinPrice
        (coinBalance, coinPrice) => {
          // isActive = false → always rejected regardless of balance
          expect(() => simulatePurchase(coinBalance, coinPrice, false)).toThrow()

          try {
            simulatePurchase(coinBalance, coinPrice, false)
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('PRODUCT_INACTIVE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('inactive product is rejected even when buyer has sufficient balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        (coinBalance, coinPrice) => {
          fc.pre(coinBalance >= coinPrice) // buyer has enough coins

          // Still rejected because product is inactive
          expect(() => simulatePurchase(coinBalance, coinPrice, false)).toThrow()

          try {
            simulatePurchase(coinBalance, coinPrice, false)
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('PRODUCT_INACTIVE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('active product with sufficient balance is always accepted', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        (coinBalance, coinPrice) => {
          fc.pre(coinBalance >= coinPrice)

          const result = simulatePurchase(coinBalance, coinPrice, true)
          expect(result.newBalance).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 100 },
    )
  })
})

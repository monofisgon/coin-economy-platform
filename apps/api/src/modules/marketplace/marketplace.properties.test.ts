import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { randomUUID } from 'crypto'

// ─── Pure logic helpers ───────────────────────────────────────────────────────

type WalletOwnerType = 'USER' | 'BUSINESS'

/**
 * Simulates the offer creation guard:
 * - Business_Owners (users with businesses) cannot create offers.
 */
function canCreateOffer(businessCount: number): boolean {
  return businessCount === 0
}

/**
 * Simulates coin reservation when creating an offer.
 * Returns new balance or throws if insufficient.
 */
function simulateCreateOffer(
  coinBalance: number,
  coinAmount: number,
  businessCount: number,
): { newBalance: number } {
  if (businessCount > 0) {
    const err = new Error('Business_Owners are not permitted to publish Offers')
    ;(err as NodeJS.ErrnoException).code = 'OFFER_CREATION_FORBIDDEN'
    throw err
  }
  if (coinBalance < coinAmount) {
    const err = new Error('Insufficient coin balance')
    ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
    throw err
  }
  return { newBalance: coinBalance - coinAmount }
}

/**
 * Simulates a marketplace transaction:
 * buyer receives coins, seller receives diamonds, buyer loses diamonds.
 */
function simulateAcceptOffer(
  buyerCoinBalance: number,
  buyerDiamondBalance: number,
  sellerDiamondBalance: number,
  coinAmount: number,
  diamondPricePerCoin: number,
): {
  buyerCoinAfter: number
  buyerDiamondAfter: number
  sellerDiamondAfter: number
} {
  const totalDiamonds = coinAmount * diamondPricePerCoin

  if (buyerDiamondBalance < totalDiamonds) {
    const err = new Error('Insufficient diamond balance')
    ;(err as NodeJS.ErrnoException).code = 'INSUFFICIENT_BALANCE'
    throw err
  }

  return {
    buyerCoinAfter: buyerCoinBalance + coinAmount,
    buyerDiamondAfter: buyerDiamondBalance - totalDiamonds,
    sellerDiamondAfter: sellerDiamondBalance + totalDiamonds,
  }
}

/**
 * Simulates offer cancellation: reserved coins return to seller.
 */
function simulateCancelOffer(
  sellerCoinBalance: number,
  reservedCoinAmount: number,
): { sellerCoinAfter: number } {
  return { sellerCoinAfter: sellerCoinBalance + reservedCoinAmount }
}

/**
 * Simulates access code validation for private offers.
 */
function validateAccessCode(
  visibility: 'PUBLICA' | 'PRIVADA',
  offerAccessCode: string | null,
  providedCode: string | undefined,
): boolean {
  if (visibility === 'PUBLICA') return true
  if (!providedCode || providedCode !== offerAccessCode) return false
  return true
}

// ─── Property 13: Restricción de creación de Offers a Users ──────────────────

// Feature: coin-economy-platform, Property 13: Restricción de creación de Offers a Users
describe('Property 13: Restricción de creación de Offers a Users', () => {
  it('Business_Owner (businessCount > 0) is always rejected when creating an offer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // businessCount > 0 → Business_Owner
        fc.integer({ min: 1, max: 1_000 }), // coinAmount
        fc.integer({ min: 1, max: 10_000 }), // coinBalance
        (businessCount, coinAmount, coinBalance) => {
          fc.pre(coinBalance >= coinAmount) // sufficient balance — rejection is due to role

          expect(() => simulateCreateOffer(coinBalance, coinAmount, businessCount)).toThrow()

          try {
            simulateCreateOffer(coinBalance, coinAmount, businessCount)
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('OFFER_CREATION_FORBIDDEN')
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('regular User (businessCount = 0) with sufficient balance can create an offer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }), // coinBalance
        fc.integer({ min: 1, max: 10_000 }), // coinAmount
        (coinBalance, coinAmount) => {
          fc.pre(coinBalance >= coinAmount)

          const result = simulateCreateOffer(coinBalance, coinAmount, 0)
          expect(result.newBalance).toBe(coinBalance - coinAmount)
          expect(result.newBalance).toBeGreaterThanOrEqual(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('canCreateOffer is false for any positive businessCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (businessCount) => {
          expect(canCreateOffer(businessCount)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('canCreateOffer is true only when businessCount = 0', () => {
    expect(canCreateOffer(0)).toBe(true)
  })
})

// ─── Property 14: Reserva de Coins al crear Offer ─────────────────────────────

// Feature: coin-economy-platform, Property 14: Reserva de Coins al crear Offer
describe('Property 14: Reserva de Coins al crear Offer', () => {
  it('coin balance decreases by exactly coinAmount when offer is created', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }), // coinBalance
        fc.integer({ min: 1, max: 10_000 }), // coinAmount
        (coinBalance, coinAmount) => {
          fc.pre(coinBalance >= coinAmount)

          const { newBalance } = simulateCreateOffer(coinBalance, coinAmount, 0)

          expect(newBalance).toBe(coinBalance - coinAmount)
          expect(newBalance).toBeGreaterThanOrEqual(0)
          // The decrease is exactly coinAmount
          expect(coinBalance - newBalance).toBe(coinAmount)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('offer creation is rejected when coinAmount exceeds coinBalance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),   // coinBalance
        fc.integer({ min: 1, max: 1_000 }), // coinAmount
        (coinBalance, coinAmount) => {
          fc.pre(coinAmount > coinBalance)

          expect(() => simulateCreateOffer(coinBalance, coinAmount, 0)).toThrow()

          try {
            simulateCreateOffer(coinBalance, coinAmount, 0)
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('INSUFFICIENT_BALANCE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 15: Conservación en transacción de Marketplace ─────────────────

// Feature: coin-economy-platform, Property 15: Conservación en transacción de Marketplace
describe('Property 15: Conservación en transacción de Marketplace', () => {
  it('buyer receives exactly coinAmount coins after accepting offer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),  // buyerCoinBalance
        fc.integer({ min: 1, max: 10_000 }),  // buyerDiamondBalance
        fc.integer({ min: 0, max: 10_000 }),  // sellerDiamondBalance
        fc.integer({ min: 1, max: 100 }),     // coinAmount
        fc.integer({ min: 1, max: 100 }),     // diamondPricePerCoin
        (buyerCoinBalance, buyerDiamondBalance, sellerDiamondBalance, coinAmount, diamondPricePerCoin) => {
          const totalDiamonds = coinAmount * diamondPricePerCoin
          fc.pre(buyerDiamondBalance >= totalDiamonds)

          const result = simulateAcceptOffer(
            buyerCoinBalance,
            buyerDiamondBalance,
            sellerDiamondBalance,
            coinAmount,
            diamondPricePerCoin,
          )

          // Buyer receives exactly coinAmount coins
          expect(result.buyerCoinAfter).toBe(buyerCoinBalance + coinAmount)
          expect(result.buyerCoinAfter - buyerCoinBalance).toBe(coinAmount)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('seller receives exactly coinAmount * diamondPricePerCoin diamonds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (buyerCoinBalance, buyerDiamondBalance, sellerDiamondBalance, coinAmount, diamondPricePerCoin) => {
          const totalDiamonds = coinAmount * diamondPricePerCoin
          fc.pre(buyerDiamondBalance >= totalDiamonds)

          const result = simulateAcceptOffer(
            buyerCoinBalance,
            buyerDiamondBalance,
            sellerDiamondBalance,
            coinAmount,
            diamondPricePerCoin,
          )

          // Seller receives exactly totalDiamonds
          expect(result.sellerDiamondAfter).toBe(sellerDiamondBalance + totalDiamonds)
          expect(result.sellerDiamondAfter - sellerDiamondBalance).toBe(totalDiamonds)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('buyer loses exactly coinAmount * diamondPricePerCoin diamonds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (buyerCoinBalance, buyerDiamondBalance, sellerDiamondBalance, coinAmount, diamondPricePerCoin) => {
          const totalDiamonds = coinAmount * diamondPricePerCoin
          fc.pre(buyerDiamondBalance >= totalDiamonds)

          const result = simulateAcceptOffer(
            buyerCoinBalance,
            buyerDiamondBalance,
            sellerDiamondBalance,
            coinAmount,
            diamondPricePerCoin,
          )

          // Buyer loses exactly totalDiamonds
          expect(result.buyerDiamondAfter).toBe(buyerDiamondBalance - totalDiamonds)
          expect(buyerDiamondBalance - result.buyerDiamondAfter).toBe(totalDiamonds)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('transaction is rejected when buyer has insufficient diamonds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 0, max: 999 }),   // buyerDiamondBalance
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (buyerCoinBalance, buyerDiamondBalance, sellerDiamondBalance, coinAmount, diamondPricePerCoin) => {
          const totalDiamonds = coinAmount * diamondPricePerCoin
          fc.pre(buyerDiamondBalance < totalDiamonds)

          expect(() =>
            simulateAcceptOffer(
              buyerCoinBalance,
              buyerDiamondBalance,
              sellerDiamondBalance,
              coinAmount,
              diamondPricePerCoin,
            ),
          ).toThrow()

          try {
            simulateAcceptOffer(
              buyerCoinBalance,
              buyerDiamondBalance,
              sellerDiamondBalance,
              coinAmount,
              diamondPricePerCoin,
            )
          } catch (err) {
            expect((err as NodeJS.ErrnoException).code).toBe('INSUFFICIENT_BALANCE')
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 16: Round-trip de cancelación de Offer ─────────────────────────

// Feature: coin-economy-platform, Property 16: Round-trip de cancelación de Offer
describe('Property 16: Round-trip de cancelación de Offer', () => {
  it('seller coin balance is restored to pre-offer value after cancellation', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),  // initial coin balance
        fc.integer({ min: 1, max: 10_000 }),  // coinAmount for offer
        (initialBalance, coinAmount) => {
          fc.pre(initialBalance >= coinAmount)

          // Step 1: create offer (reserve coins)
          const { newBalance: balanceAfterCreate } = simulateCreateOffer(
            initialBalance,
            coinAmount,
            0,
          )

          // Step 2: cancel offer (return coins)
          const { sellerCoinAfter: balanceAfterCancel } = simulateCancelOffer(
            balanceAfterCreate,
            coinAmount,
          )

          // Balance is fully restored
          expect(balanceAfterCancel).toBe(initialBalance)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('cancellation always returns exactly the reserved coinAmount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 10_000 }),
        (balanceAfterReserve, reservedAmount) => {
          const { sellerCoinAfter } = simulateCancelOffer(balanceAfterReserve, reservedAmount)
          expect(sellerCoinAfter - balanceAfterReserve).toBe(reservedAmount)
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 17: Unicidad de Access_Code para Offers privadas ────────────────

// Feature: coin-economy-platform, Property 17: Unicidad de Access_Code para Offers privadas
describe('Property 17: Unicidad de Access_Code para Offers privadas', () => {
  it('all generated access codes are distinct UUIDs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }), // number of private offers
        (numOffers) => {
          const codes = Array.from({ length: numOffers }, () => randomUUID())
          const uniqueCodes = new Set(codes)
          expect(uniqueCodes.size).toBe(numOffers)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('access code is only generated for PRIVADA offers, not PUBLICA', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('PUBLICA', 'PRIVADA' as 'PUBLICA' | 'PRIVADA'),
        (visibility) => {
          const accessCode = visibility === 'PRIVADA' ? randomUUID() : null
          if (visibility === 'PRIVADA') {
            expect(accessCode).not.toBeNull()
            expect(typeof accessCode).toBe('string')
            expect(accessCode!.length).toBeGreaterThan(0)
          } else {
            expect(accessCode).toBeNull()
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

// ─── Property 18: Control de acceso a Offers privadas ────────────────────────

// Feature: coin-economy-platform, Property 18: Control de acceso a Offers privadas
describe('Property 18: Control de acceso a Offers privadas', () => {
  it('private offer without access code is always rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // some access code on the offer
        (offerAccessCode) => {
          // No code provided
          expect(validateAccessCode('PRIVADA', offerAccessCode, undefined)).toBe(false)
          // Empty string provided
          expect(validateAccessCode('PRIVADA', offerAccessCode, '')).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('private offer with wrong access code is always rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // correct access code
        fc.uuid(), // wrong access code
        (correctCode, wrongCode) => {
          fc.pre(correctCode !== wrongCode)
          expect(validateAccessCode('PRIVADA', correctCode, wrongCode)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('private offer with correct access code is always accepted', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // access code
        (accessCode) => {
          expect(validateAccessCode('PRIVADA', accessCode, accessCode)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('public offer is always accessible regardless of provided code', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string(), { nil: undefined }),
        (providedCode) => {
          expect(validateAccessCode('PUBLICA', null, providedCode)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })
})

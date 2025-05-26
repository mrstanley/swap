import { randomBytes } from "node:crypto";
import * as anchor from "@coral-xyz/anchor";
import { Program, web3, BN } from "@coral-xyz/anchor";
import { Swap } from "../target/types/swap";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { confirmTransaction, createAccountsMintsAndTokenAccounts } from "@solana-developers/helpers";
import { assert } from "chai";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID = TOKEN_2022_PROGRAM_ID;

const SECONDS = 1000;

// Tests must complete within half this time otherwise
// they are marked as slow. Since Anchor involves a little
// network IO, these tests usually take about 15 seconds.
const ANCHOR_SLOW_TEST_THRESHOLD = 40 * SECONDS;

const getRandomBigNumber = (size = 8) => {
  return new BN(randomBytes(size));
};

describe("swap", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.swap as Program<Swap>;

  const connection = provider.connection;

  const payer = provider.wallet.payer

  const accounts: Record<string, web3.PublicKey> = {
    tokenProgram: TOKEN_PROGRAM
  }

  let alice: web3.Keypair,
    bob: web3.Keypair,
    tokenMintA: web3.Keypair,
    tokenMintB: web3.Keypair,
    aliceTokenAccountA: web3.PublicKey,
    aliceTokenAccountB: web3.PublicKey,
    bobTokenAccountA: web3.PublicKey,
    bobTokenAccountB: web3.PublicKey;

  const tokenAOfferedAmount = new BN(1_000_000);
  const tokenBWantedAmount = new BN(1_000_000);

  before("init accounts", async () => {
    const usersMintsAndTokenAccounts = await createAccountsMintsAndTokenAccounts(
      [
        [1_000_000_000, 0], // alice has 1_000_000_000 of token A and 0 of token B
        [0, 1_000_000_000], // bob has 0 of token A and 1_000_000_000 of token B
      ],
      1 * web3.LAMPORTS_PER_SOL,
      connection,
      payer,
    );
    [alice, bob] = usersMintsAndTokenAccounts.users;
    [tokenMintA, tokenMintB] = usersMintsAndTokenAccounts.mints;
    [
      [aliceTokenAccountA, aliceTokenAccountB],
      [bobTokenAccountA, bobTokenAccountB]
    ] = usersMintsAndTokenAccounts.tokenAccounts;

    accounts.maker = alice.publicKey;
    accounts.taker = bob.publicKey;
    accounts.tokenMintA = tokenMintA.publicKey;
    accounts.makerTokenAccountA = aliceTokenAccountA;
    accounts.takerTokenAccountA = bobTokenAccountA;
    accounts.tokenMintB = tokenMintB.publicKey;
    accounts.makerTokenAccountB = aliceTokenAccountB;
    accounts.takerTokenAccountB = bobTokenAccountB;

  })

  it("make offer", async () => {
    // Pick a random ID for the offer we'll make
    const offerId = getRandomBigNumber();
    const [offer] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        accounts.maker.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    const vault = getAssociatedTokenAddressSync(accounts.tokenMintA, offer, true, TOKEN_PROGRAM);

    accounts.offer = offer;
    accounts.vault = vault;

    const sn = await program.methods
      .makeOffer(offerId, tokenAOfferedAmount, tokenBWantedAmount)
      .accounts({ ...accounts })
      .signers([alice])
      .rpc();

    await confirmTransaction(connection, sn);

    // check our vault contains the tokens offered
    const vaultBalanceResponse = await connection.getTokenAccountBalance(vault);
    const vaultBalance = new BN(vaultBalanceResponse.value.amount);
    assert(vaultBalance.eq(tokenAOfferedAmount));
    // check our offer account contains the correct data
    const offerAccount = await program.account.offer.fetch(offer);
    assert(offerAccount.maker.equals(alice.publicKey));
    assert(offerAccount.tokenMintA.equals(accounts.tokenMintA));
    assert(offerAccount.tokenMintB.equals(accounts.tokenMintB));
    assert(offerAccount.tokenBWantedAmount.eq(tokenBWantedAmount));

  }).slow(ANCHOR_SLOW_TEST_THRESHOLD);

  it("take offer", async () => {
    const transactionSignature = await program.methods
      .takeOffer()
      .accounts({ ...accounts })
      .signers([bob])
      .rpc();

    await confirmTransaction(connection, transactionSignature);

    // Check the offered tokens are now in Bob's account
    // (note: there is no before balance as Bob didn't have any offered tokens before the transaction)
    const bobTokenAccountBalanceAfterResponse =
      await connection.getTokenAccountBalance(accounts.takerTokenAccountA);
    const bobTokenAccountBalanceAfter = new BN(
      bobTokenAccountBalanceAfterResponse.value.amount
    );
    assert(bobTokenAccountBalanceAfter.eq(tokenAOfferedAmount));

    // Check the wanted tokens are now in Alice's account
    // (note: there is no before balance as Alice didn't have any wanted tokens before the transaction)
    const aliceTokenAccountBalanceAfterResponse =
      await connection.getTokenAccountBalance(accounts.makerTokenAccountB);
    const aliceTokenAccountBalanceAfter = new BN(
      aliceTokenAccountBalanceAfterResponse.value.amount
    );
    assert(aliceTokenAccountBalanceAfter.eq(tokenBWantedAmount));
  }).slow(ANCHOR_SLOW_TEST_THRESHOLD);

});
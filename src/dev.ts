import { createUpsClient } from "./carriers/ups";

async function main() {
  const ups = createUpsClient();
  const rates = await ups.rateShop({
    origin: {
      street1: "1 Main",
      city: "NYC",
      state: "NY",
      postalCode: "10001",
      countryCode: "US",
    },
    destination: {
      street1: "2 Market",
      city: "SF",
      state: "CA",
      postalCode: "94105",
      countryCode: "US",
    },
    parcel: { weightKg: 1.2, lengthCm: 20, widthCm: 10, heightCm: 5 },
  });
  console.log(rates);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

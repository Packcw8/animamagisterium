import { supabase, type Tables } from "../lib/supabase";
import type { CharacterWithDetails } from "./characterService";
import type { InventoryItem, ItemDefinition } from "./inventoryService";

export type PlayerMarketSpot = Tables["player_market_spots"];
export type PlayerMarketListing = Tables["player_market_listings"];

export type HydratedPlayerMarketListing = PlayerMarketListing & {
  item: ItemDefinition;
  spot: PlayerMarketSpot | null;
};

export type PlayerMarketState = {
  spots: PlayerMarketSpot[];
  listings: HydratedPlayerMarketListing[];
  mySpot: PlayerMarketSpot | null;
};

export async function getPlayerMarketState(markerId: string, characterId: string, itemDefinitions: ItemDefinition[]): Promise<PlayerMarketState> {
  const [spotsResult, listingsResult] = await Promise.all([
    supabase
      .from("player_market_spots")
      .select("*")
      .eq("marker_id", markerId)
      .eq("is_active", true)
      .gt("rented_until", new Date().toISOString())
      .order("slot_number", { ascending: true }),
    supabase
      .from("player_market_listings")
      .select("*")
      .eq("marker_id", markerId)
      .eq("is_active", true)
      .gt("quantity_available", 0)
      .order("created_at", { ascending: false }),
  ]);

  if (spotsResult.error) {
    throw spotsResult.error;
  }
  if (listingsResult.error) {
    throw listingsResult.error;
  }

  const spots = (spotsResult.data ?? []) as PlayerMarketSpot[];
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));
  const itemById = new Map(itemDefinitions.map((item) => [item.id, item]));
  const listings = ((listingsResult.data ?? []) as PlayerMarketListing[])
    .map((listing) => {
      const item = itemById.get(listing.item_id);
      return item ? { ...listing, item, spot: spotById.get(listing.spot_id) ?? null } : null;
    })
    .filter(Boolean) as HydratedPlayerMarketListing[];

  return {
    spots,
    listings,
    mySpot: spots.find((spot) => spot.owner_character_id === characterId) ?? null,
  };
}

export async function claimPlayerMarketSpot(markerId: string, character: CharacterWithDetails, stallName?: string | null) {
  const { data, error } = await supabase.rpc("claim_player_market_spot", {
    p_marker_id: markerId,
    p_character_id: character.id,
    p_stall_name: stallName || `${character.name}'s Stall`,
  });

  if (error) {
    throw error;
  }

  return data as PlayerMarketSpot;
}

export async function createPlayerMarketListing(spotId: string, characterId: string, inventoryItem: InventoryItem, quantity: number, pricePerItem: number) {
  const { data, error } = await supabase.rpc("create_player_market_listing", {
    p_spot_id: spotId,
    p_character_id: characterId,
    p_item_id: inventoryItem.item_id,
    p_quantity: normalizeMarketQuantity(quantity),
    p_price_per_item: Math.max(0, Math.floor(Number(pricePerItem) || 0)),
  });

  if (error) {
    throw error;
  }

  return data as PlayerMarketListing;
}

export async function cancelPlayerMarketListing(listingId: string, characterId: string) {
  const { error } = await supabase.rpc("cancel_player_market_listing", {
    p_listing_id: listingId,
    p_character_id: characterId,
  });

  if (error) {
    throw error;
  }
}

export async function buyPlayerMarketListing(listingId: string, buyerCharacterId: string, quantity = 1) {
  const { data, error } = await supabase.rpc("buy_player_market_listing", {
    p_listing_id: listingId,
    p_buyer_character_id: buyerCharacterId,
    p_quantity: normalizeMarketQuantity(quantity),
  });

  if (error) {
    throw error;
  }

  return data as Tables["characters"];
}

function normalizeMarketQuantity(quantity: number) {
  return Math.max(1, Math.floor(Number(quantity) || 1));
}

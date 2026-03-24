/**
 * Batch-fetch Universalis aggregated API and map into ItemTable / SearchResultsTable state shape.
 * Shared by MSQ-style pages and Company Craft list (same response parsing as MSQPriceChecker).
 */

import axios from 'axios';

/**
 * @param {object} params
 * @param {{ section: string, dcObj?: { worlds?: unknown[] } }} params.selectedWorld
 * @param {string|number} params.selectedServerOption
 * @param {number[]} params.itemIdsToQuery - tradeable IDs to request
 * @param {number[]} params.finalItemIds - all item IDs to mark tradability for
 * @param {(msg: string, type?: string) => void} [params.addToast]
 * @returns {Promise<{ itemVelocities: Object, itemAveragePrices: Object, itemMinListings: Object, itemRecentPurchases: Object, itemTradability: Object }>}
 */
export async function fetchAggregatedPricesForItemTable({
  selectedWorld,
  selectedServerOption,
  itemIdsToQuery,
  finalItemIds,
  addToast,
}) {
  const empty = {
    itemVelocities: {},
    itemAveragePrices: {},
    itemMinListings: {},
    itemRecentPurchases: {},
    itemTradability: {},
  };

  if (!selectedWorld || !selectedServerOption) {
    if (addToast) addToast('請選擇伺服器', 'warning');
    return empty;
  }

  const isDCQuery = selectedServerOption === selectedWorld.section;
  const queryTarget = isDCQuery ? selectedWorld.section : selectedServerOption;

  const batchSize = 100;
  const allVelocities = {};
  const allAveragePrices = {};
  const allMinListings = {};
  const allRecentPurchases = {};
  const allTradability = {};

  for (let i = 0; i < itemIdsToQuery.length; i += batchSize) {
    const batch = itemIdsToQuery.slice(i, i + batchSize);
    const itemIdsString = batch.join(',');

    try {
      const response = await axios.get(
        `https://universalis.app/api/v2/aggregated/${encodeURIComponent(queryTarget)}/${itemIdsString}`
      );

      const data = response.data;
      if (data && data.results) {
        data.results.forEach((item) => {
          const itemId = item.itemId;

          const getValue = (nqData, hqData, field) => {
            const nqWorld = nqData?.world?.[field];
            const hqWorld = hqData?.world?.[field];
            const nqDc = nqData?.dc?.[field];
            const hqDc = hqData?.dc?.[field];

            const nqValue = isDCQuery
              ? (nqDc !== undefined ? nqDc : nqWorld)
              : (nqWorld !== undefined ? nqWorld : undefined);
            const hqValue = isDCQuery
              ? (hqDc !== undefined ? hqDc : hqWorld)
              : (hqWorld !== undefined ? hqWorld : undefined);

            if (field === 'quantity') {
              if (nqValue !== undefined || hqValue !== undefined) {
                return (nqValue || 0) + (hqValue || 0);
              }
            } else {
              if (nqValue !== undefined && hqValue !== undefined) {
                return Math.min(nqValue, hqValue);
              }
              if (hqValue !== undefined) return hqValue;
              if (nqValue !== undefined) return nqValue;
            }
            return null;
          };

          const velocity = getValue(
            item.nq?.dailySaleVelocity,
            item.hq?.dailySaleVelocity,
            'quantity'
          );

          let averagePrice = null;
          if (!isDCQuery) {
            const nqWorld = item.nq?.averageSalePrice?.world?.price;
            const hqWorld = item.hq?.averageSalePrice?.world?.price;
            const nqDc = item.nq?.averageSalePrice?.dc?.price;
            const hqDc = item.hq?.averageSalePrice?.dc?.price;

            const nqValue = nqWorld !== undefined ? nqWorld : nqDc;
            const hqValue = hqWorld !== undefined ? hqWorld : hqDc;

            if (nqValue !== undefined && hqValue !== undefined) {
              averagePrice = Math.min(nqValue, hqValue);
            } else if (hqValue !== undefined) {
              averagePrice = hqValue;
            } else if (nqValue !== undefined) {
              averagePrice = nqValue;
            }
          } else {
            averagePrice = getValue(
              item.nq?.averageSalePrice,
              item.hq?.averageSalePrice,
              'price'
            );
          }

          const minListingPrice = getValue(
            item.nq?.minListing,
            item.hq?.minListing,
            'price'
          );

          const recentPurchasePrice = getValue(
            item.nq?.recentPurchase,
            item.hq?.recentPurchase,
            'price'
          );

          let minListing = null;
          if (minListingPrice !== null && minListingPrice !== undefined) {
            if (!isDCQuery) {
              const nqWorldPrice = item.nq?.minListing?.world?.price;
              const hqWorldPrice = item.hq?.minListing?.world?.price;

              let selectedData = null;
              if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                selectedData =
                  hqWorldPrice <= nqWorldPrice
                    ? item.hq?.minListing?.world
                    : item.nq?.minListing?.world;
              } else if (hqWorldPrice !== undefined) {
                selectedData = item.hq?.minListing?.world;
              } else if (nqWorldPrice !== undefined) {
                selectedData = item.nq?.minListing?.world;
              }

              const region = selectedData?.region;
              minListing = { price: minListingPrice };
              if (region !== undefined) {
                minListing.region = region;
              }
            } else {
              minListing = minListingPrice;
            }
          }

          let recentPurchase = null;
          if (recentPurchasePrice !== null && recentPurchasePrice !== undefined) {
            if (!isDCQuery) {
              const nqWorldPrice = item.nq?.recentPurchase?.world?.price;
              const hqWorldPrice = item.hq?.recentPurchase?.world?.price;

              let selectedData = null;
              if (nqWorldPrice !== undefined && hqWorldPrice !== undefined) {
                selectedData =
                  hqWorldPrice <= nqWorldPrice
                    ? item.hq?.recentPurchase?.world
                    : item.nq?.recentPurchase?.world;
              } else if (hqWorldPrice !== undefined) {
                selectedData = item.hq?.recentPurchase?.world;
              } else if (nqWorldPrice !== undefined) {
                selectedData = item.nq?.recentPurchase?.world;
              }

              const region = selectedData?.region;
              recentPurchase = { price: recentPurchasePrice };
              if (region !== undefined) {
                recentPurchase.region = region;
              }
            } else {
              recentPurchase = recentPurchasePrice;
            }
          }

          if (velocity !== null && velocity !== undefined) {
            allVelocities[itemId] = velocity;
          }
          if (averagePrice !== null && averagePrice !== undefined) {
            allAveragePrices[itemId] = Math.round(averagePrice);
          }
          if (minListing !== null && minListing !== undefined) {
            allMinListings[itemId] = minListing;
          }
          if (recentPurchase !== null && recentPurchase !== undefined) {
            allRecentPurchases[itemId] = recentPurchase;
          }
          allTradability[itemId] = true;
        });
      }

      batch.forEach((itemId) => {
        if (!Object.prototype.hasOwnProperty.call(allTradability, itemId)) {
          allTradability[itemId] = false;
        }
      });
    } catch (error) {
      console.error('Error fetching market data:', error);
      batch.forEach((itemId) => {
        if (!Object.prototype.hasOwnProperty.call(allTradability, itemId)) {
          allTradability[itemId] = false;
        }
      });
    }
  }

  finalItemIds.forEach((itemId) => {
    if (!itemIdsToQuery.includes(itemId)) {
      allTradability[itemId] = false;
    }
  });

  return {
    itemVelocities: allVelocities,
    itemAveragePrices: allAveragePrices,
    itemMinListings: allMinListings,
    itemRecentPurchases: allRecentPurchases,
    itemTradability: allTradability,
  };
}

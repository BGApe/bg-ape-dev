import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import type { CollectionGame } from '@/features/collection/types';
import { firestoreLocationsRepository } from '@/features/locations/api/FirestoreLocationsRepository';
import { firestorePlayersRepository } from '@/features/players/api/FirestorePlayersRepository';
import { mapError } from '@/lib/mapError';
import { firebaseAnalytics } from '@/services/analytics';
import { logger } from '@/services/logger';
import type { LocationId, PlayerId } from '@/types';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';
import type { NewPlay, NewPlayParticipant, PlayParticipant } from '../types';

/**
 * Resolves a NewPlayParticipant to a PlayParticipant:
 * - If playerId is already set, uses it directly.
 * - Otherwise finds an existing player by name (case-insensitive) or creates a new profile.
 * Returns the resolved participant with a guaranteed playerId.
 */
async function resolveParticipant(
  uid: Parameters<typeof firestorePlayersRepository.list>[0],
  participant: NewPlayParticipant,
  existingPlayers: Awaited<ReturnType<typeof firestorePlayersRepository.list>>,
): Promise<PlayParticipant> {
  if (participant.playerId) {
    const p: PlayParticipant = {
      playerId: participant.playerId,
      name: participant.name,
      won: participant.won,
    };
    if (participant.score !== undefined) p.score = participant.score;
    return p;
  }

  const nameLower = participant.name.trim().toLowerCase();
  const existing = existingPlayers.find((p) => p.name.toLowerCase() === nameLower);

  const playerId: PlayerId = existing
    ? existing.id
    : (await firestorePlayersRepository.add(uid, { name: participant.name.trim() })).id;

  const p: PlayParticipant = { playerId, name: participant.name.trim(), won: participant.won };
  if (participant.score !== undefined) p.score = participant.score;
  return p;
}

export function useLogPlay() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: async (play: NewPlay) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));

      const uid = user.uid;
      let resolvedPlay = { ...play };

      // ── Resolve participants ──────────────────────────────────────────────
      if (play.participants && play.participants.length > 0) {
        const existingPlayers = await firestorePlayersRepository.list(uid);
        const resolved = await Promise.all(
          play.participants.map((p) => resolveParticipant(uid, p, existingPlayers)),
        );
        resolvedPlay = { ...resolvedPlay, participants: resolved };

        // Invalidate players cache in case new profiles were created
        void queryClient.invalidateQueries({ queryKey: QueryKeys.players.list(uid) });
      }

      // ── Resolve location ──────────────────────────────────────────────────
      if (!play.locationId && play.locationName && play.locationName.trim().length > 0) {
        const existingLocations = await firestoreLocationsRepository.list(uid);
        const nameLower = play.locationName.trim().toLowerCase();
        const existing = existingLocations.find((l) => l.name.toLowerCase() === nameLower);

        const locationId: LocationId = existing
          ? existing.id
          : (await firestoreLocationsRepository.add(uid, { name: play.locationName.trim() })).id;

        resolvedPlay = { ...resolvedPlay, locationId };
        void queryClient.invalidateQueries({ queryKey: QueryKeys.locations.list(uid) });
      }

      // ── Denormalize game metadata from collection cache ───────────────────
      if (play.gameId) {
        const games =
          queryClient.getQueryData<CollectionGame[]>(QueryKeys.collection.list(uid)) ?? [];
        const game = games.find((g) => g.id === play.gameId);
        if (game) {
          if (game.categories && game.categories.length > 0) {
            resolvedPlay = { ...resolvedPlay, gameCategories: game.categories };
          }
          if (game.mechanics && game.mechanics.length > 0) {
            resolvedPlay = { ...resolvedPlay, gameMechanics: game.mechanics };
          }
          if (game.averageWeight !== undefined) {
            resolvedPlay = { ...resolvedPlay, gameWeight: game.averageWeight };
          }
        }
      }

      return firestorePlaysRepository.add(uid, resolvedPlay);
    },

    onSuccess(_result, variables) {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
      firebaseAnalytics.track('play_logged', { fromCollection: variables.gameId !== undefined });
    },

    onError(error) {
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}

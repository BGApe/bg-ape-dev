import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QueryKeys } from '@/constants/queryKeys';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { firestoreLocationsRepository } from '@/features/locations/api/FirestoreLocationsRepository';
import { firestorePlayersRepository } from '@/features/players/api/FirestorePlayersRepository';
import { mapError } from '@/lib/mapError';
import { logger } from '@/services/logger';
import type { LocationId, PlayId, PlayerId } from '@/types';

import { firestorePlaysRepository } from '../api/FirestorePlaysRepository';
import type { NewPlay, NewPlayParticipant, Play, PlayParticipant, PlayPatch } from '../types';

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

/** Converts a NewPlay-shaped payload into a PlayPatch with resolved ids. */
export async function resolvePlayPatch(
  uid: Parameters<typeof firestorePlayersRepository.list>[0],
  play: NewPlay,
): Promise<PlayPatch> {
  const patch: PlayPatch = {
    gameName: play.gameName,
    playedAt: play.playedAt,
  };
  if (play.gameId !== undefined) patch.gameId = play.gameId;
  if (play.durationMinutes !== undefined) patch.durationMinutes = play.durationMinutes;
  if (play.note !== undefined) patch.note = play.note;
  if (play.expansionIds !== undefined) patch.expansionIds = play.expansionIds;
  if (play.expansionNames !== undefined) patch.expansionNames = play.expansionNames;

  if (play.participants && play.participants.length > 0) {
    const existingPlayers = await firestorePlayersRepository.list(uid);
    patch.participants = await Promise.all(
      play.participants.map((p) => resolveParticipant(uid, p, existingPlayers)),
    );
    patch.playerCount = patch.participants.length;
  }

  if (!play.locationId && play.locationName && play.locationName.trim().length > 0) {
    const existingLocations = await firestoreLocationsRepository.list(uid);
    const nameLower = play.locationName.trim().toLowerCase();
    const existing = existingLocations.find((l) => l.name.toLowerCase() === nameLower);
    const locationId: LocationId = existing
      ? existing.id
      : (await firestoreLocationsRepository.add(uid, { name: play.locationName.trim() })).id;
    patch.locationId = locationId;
    patch.locationName = play.locationName.trim();
  } else if (play.locationId !== undefined) {
    patch.locationId = play.locationId;
    if (play.locationName !== undefined) patch.locationName = play.locationName;
  }

  return patch;
}

export function useUpdatePlay() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: async (
      args: { playId: PlayId; patch: PlayPatch } | { playId: PlayId; play: NewPlay },
    ) => {
      if (!user) return Promise.reject(new Error('Not authenticated.'));
      const patch = 'play' in args ? await resolvePlayPatch(user.uid, args.play) : args.patch;
      return firestorePlaysRepository.update(user.uid, args.playId, patch);
    },

    onMutate: (args) => {
      if (!user) return;
      if (!('patch' in args)) return;
      queryClient.setQueryData<Play[]>(QueryKeys.plays.list(user.uid), (prev) =>
        (prev ?? []).map((p) => (p.id === args.playId ? { ...p, ...args.patch } : p)),
      );
    },

    onSuccess() {
      if (!user) return;
      void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.players.list(user.uid) });
      void queryClient.invalidateQueries({ queryKey: QueryKeys.locations.list(user.uid) });
    },

    onError(error) {
      if (user) {
        void queryClient.invalidateQueries({ queryKey: QueryKeys.plays.list(user.uid) });
      }
      logger.captureException(error, { mapped: mapError(error) });
    },
  });
}

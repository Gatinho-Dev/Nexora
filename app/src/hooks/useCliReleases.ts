import { useQuery } from "@tanstack/react-query";
import { fetchCliReleases } from "@/services/github/cliReleases";
import type { CliReleasesResponse } from "@contracts/cliReleases";

export function useCliReleases() {
  return useQuery<CliReleasesResponse, Error>({
    queryKey: ["cli-releases"],
    queryFn: ({ signal }) => fetchCliReleases(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

const isVisible = (project: Project): boolean =>
  import.meta.env.PROD ? !project.data.draft : true;

const STATUS_LABELS: Record<Project['data']['status'], string> = {
  live: 'live',
  broken: 'broken',
  wip: 'wip',
  archived: 'archived',
  job: 'day job',
};

const isJob = (project: Project): boolean => project.data.status === 'job';

const shippedAt = (project: Project): number => project.data.date?.getTime() ?? 0;

/** All visible projects, the day job first, then newest. Drafts are hidden in production builds. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', isVisible);
  return projects.sort((a, b) => {
    if (isJob(a) !== isJob(b)) return isJob(a) ? -1 : 1;
    return shippedAt(b) - shippedAt(a);
  });
}

/** The day job, always pinned on the home wall. */
export async function getJobs(): Promise<Project[]> {
  return (await getProjects()).filter(isJob);
}

/** Newest side projects for the home wall, the day job excluded. */
export async function getRecentProjects(limit: number): Promise<Project[]> {
  return (await getProjects()).filter((p) => !isJob(p)).slice(0, limit);
}

/** Display label for a project status. */
export function statusLabel(status: Project['data']['status']): string {
  return STATUS_LABELS[status];
}

/** Shared name so the row title morphs into the page heading. */
export function projectTransitionName(project: Project): string {
  return `project-${project.id.replace(/[^a-z0-9-]/gi, '-')}`;
}

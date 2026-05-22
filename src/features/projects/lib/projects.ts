import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;

const STATUS_LABELS: Record<Project['data']['status'], string> = {
  live: 'live',
  broken: 'broken on purpose',
  wip: 'wip',
  archived: 'archived',
};

/** All projects, ordered by `order` then name. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects');
  return projects.sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.name.localeCompare(b.data.name);
  });
}

/** Featured projects only, for the home page. */
export async function getFeaturedProjects(): Promise<Project[]> {
  return (await getProjects()).filter((p) => p.data.featured);
}

/** Display label for a project status. */
export function statusLabel(status: Project['data']['status']): string {
  return STATUS_LABELS[status];
}

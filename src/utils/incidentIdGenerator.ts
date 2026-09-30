import { ulid } from 'ulid';

export default function incidentIdGenerator(): string {
  return `INC-${ulid().slice(0, 10)}`;
}

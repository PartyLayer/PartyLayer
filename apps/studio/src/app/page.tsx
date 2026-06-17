// PartyLayer Studio — workbench shell (S8.2). The interactive rail + the live
// Sandpack scenario live in StudioWorkbench (client); this stays a thin server
// entry so layout/metadata remain server-rendered.
import { StudioWorkbench } from './components/StudioWorkbench';

export default function StudioHome() {
  return <StudioWorkbench />;
}

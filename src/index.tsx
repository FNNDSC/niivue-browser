import "@patternfly/react-core/dist/styles/base.css";

import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import AppLayout from "./AppLayout";
import SubplateSurfaces from "./SurfaceAndMaskViewer";
import { Client, Subject } from "./lib/client";
import "./style.css";
import { INITIAL_STATE, VisualState } from "./lib/visualstate";

export function App() {
  const client = new Client("/files/");
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [error, setError] = useState(null);
  const [visualState, setVisualState] = useState<VisualState>(INITIAL_STATE);

  useEffect(() => {
    async function load() {
      const subjects = await client.lsSubjects();
      if (subjects.length >= 1) {
        setSelectedSubject(subjects[0]);
      }
      setSubjects(subjects);
    }

    async function tryLoad() {
      try {
        await load();
      } catch (e) {
        setError(e);
      }
    }

    tryLoad();
  }, []);

  if (error != null) {
    return (
      <>
        <p>There was an error loading the data.</p>
        <p>{typeof error === "object" ? JSON.stringify(error) : error}</p>
      </>
    );
  }

  return (
    <AppLayout
      client={client}
      subjects={subjects}
      selectedSubject={selectedSubject}
      onSubjectSelect={setSelectedSubject}
      visualState={visualState}
      onVisualStateChange={setVisualState}
    >
      <SubplateSurfaces visualState={visualState} />
    </AppLayout>
  );
}

render(<App />, document.getElementById("app"));

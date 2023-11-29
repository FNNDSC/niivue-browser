import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import {
  Dropdown,
  DropdownItem,
  DropdownList,
  Masthead,
  MastheadContent,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  MenuToggleElement,
  Nav,
  NavGroup,
  NavItem,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import BarsIcon from "@patternfly/react-icons/dist/esm/icons/bars-icon";
import * as React from "preact/compat";
import { Client, Subject } from "../lib/client";
import { VisualState, organizeUrlsAsState, Mesh } from "../lib/visualstate";
import style from "./style.module.css";
import { produce } from "immer";

/**
 * A dropdown menu for selecting which subject we're looking at.
 */
const SubjectDropdown = ({
  subjects,
  selectedSubject,
  onSubjectSelect,
}: {
  subjects: Subject[];
  selectedSubject?: Subject;
  onSubjectSelect: (value: Subject) => any;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const onSelect = (
    _event: MouseEvent | undefined,
    value: string | undefined,
  ) => {
    setIsOpen(false);
    if (value === undefined) {
      return;
    }
    const selected = subjects.find((subject) => subject.name === value);
    if (selected !== undefined) {
      onSubjectSelect(selected);
    }
  };

  return (
    <>
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            onClick={onToggleClick}
            isExpanded={isOpen}
          >
            {selectedSubject.name}
          </MenuToggle>
        )}
        onSelect={onSelect}
        onOpenChange={(isOpen: boolean) => setIsOpen(isOpen)}
        isOpen={isOpen}
        ouiaId="BasicDropdown"
        shouldFocusToggleOnSelect
      >
        <DropdownList>
          {subjects.map((subject) => (
            <DropdownItem
              value={subject.name}
              key={subject.name}
              description={`age: ${ageOf(subject)}`}
            >
              {subject.name}
            </DropdownItem>
          ))}
        </DropdownList>
      </Dropdown>
    </>
  );
};

/**
 * Get the age of the subject as a string, if known.
 */
function ageOf(subject: Subject): string {
  if (!subject.info) {
    return "unknown";
  }
  const ageKey = Object.keys(subject.info).find(
    (k) => k.toLowerCase() === "age",
  );
  return `${subject.info[ageKey]}`;
}

/**
 * The page sidebar and top bar which contains controls for the application state.
 */
const MyPage = ({
  client,
  subjects,
  selectedSubject,
  onSubjectSelect,
  visualState,
  onVisualStateChange,
  children,
}: {
  client: Client;
  subjects?: Subject[];
  selectedSubject?: Subject;
  onSubjectSelect: (value) => void;
  visualState: VisualState;
  onVisualStateChange: (VisualState) => void;
  children: ComponentChildren;
}) => {
  let [prevSubjectName, setPrevSubjectName] = useState<string | null>(null);

  const leftSurfaces = visualState.meshes.filter((mesh) =>
    mesh.name.startsWith("lh."),
  );

  /**
   * Get the URLs of the subject's files and return them as a NVState.
   */
  const getNextState = async (subject: Subject): Promise<VisualState> => {
    const files = await client.getFiles(subject.name);
    return organizeUrlsAsState(files, visualState);
  };

  const changeVisibleLayer = (centerName: string) => {
    onVisualStateChange(changeVisibleLayerState(visualState, centerName));
  };

  const onNavSelect = (_event: any, result: { itemId: string | number }) =>
    changeVisibleLayer(result.itemId as string);

  useEffect(() => {
    // When the user selects a different subject from the drop-down menu, change the set of loaded URLs.
    if (selectedSubject && selectedSubject.name !== prevSubjectName) {
      getNextState(selectedSubject).then((nextState) => {
        onVisualStateChange(nextState);
        setPrevSubjectName(selectedSubject.name);
      });
    }
  }, [selectedSubject]);

  const headerToolbar = (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup align={{ default: "alignRight" }}>
          {subjects ? (
            <ToolbarItem>
              <SubjectDropdown
                subjects={subjects}
                selectedSubject={selectedSubject}
                onSubjectSelect={onSubjectSelect}
              />
            </ToolbarItem>
          ) : null}
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const header = (
    <Masthead>
      <MastheadToggle>
        <PageToggleButton variant="plain" aria-label="Global navigation">
          <BarsIcon />
        </PageToggleButton>
      </MastheadToggle>
      <MastheadMain>
        {import.meta.env.PREACT_APP_NAME === undefined
          ? "Fetal Surfaces Viewer"
          : import.meta.env.PREACT_APP_NAME}
      </MastheadMain>
      <MastheadContent>{headerToolbar}</MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody className={style.sideBar}>
        <Nav onSelect={onNavSelect}>
          <NavGroup title="Layer">
            {leftSurfaces.map((mesh) => {
              return (
                <NavItem
                  preventDefault
                  itemId={mesh.centerName}
                  isActive={mesh.visible}
                >
                  {mesh.centerName}
                </NavItem>
              );
            })}
          </NavGroup>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page header={header} sidebar={sidebar} isManagedSidebar>
      <PageSection padding={{ default: "noPadding" }} style={{ margin: "0" }}>
        {children}
      </PageSection>
    </Page>
  );
};

/**
 * Changes which meshes and volumes are visible, based on which ones match the given `centerName`.
 */
function changeVisibleLayerState(
  visualState: VisualState,
  centerName: string,
): VisualState {
  return produce(visualState, (draft) => {
    draft.meshes = visualState.meshes.map((mesh) =>
      mesh.changeVisible(centerName === mesh.centerName),
    );
    draft.volumes = visualState.volumes.map((vol) =>
      vol.changeOpacity(centerName === vol.centerName ? 1.0 : 0.0),
    );
  });
}

export default MyPage;

export { changeVisibleLayerState };

// N.B. ts(dash)ignore is used, probably preact problem.

import { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import {
  Button,
  Divider,
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
  Panel,
  PanelHeader,
  PanelMain,
  PanelMainBody,
  Popover,
  Slider,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Text,
  TextVariants,
} from "@patternfly/react-core";
import BarsIcon from "@patternfly/react-icons/dist/esm/icons/bars-icon";
import { Table, Tr, Tbody, Td } from "@patternfly/react-table";
import * as React from "preact/compat";
import { Client, Subject } from "../lib/client";
import {
  VisualState,
  organizeUrlsAsState,
  centerNameOf,
} from "../lib/visualstate";
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

enum NavSelectionClass {
  Mesh,
  MeshOverlay,
}

/**
 * Deserialized type of `itemId` for nav items in the sidebar.
 */
type NavSelection = {
  /**
   * Indicates which sidebar section the selected item is from.
   */
  action: NavSelectionClass;
  /**
   * Value of selected item.
   */
  centerName: string;
};

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
  const [prevSubjectName, setPrevSubjectName] = useState<string | null>(null);
  const calMinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calMaxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const changeMeshOverlay = (centerName: string) => {
    onVisualStateChange(changeMeshOverlayState(visualState, centerName));
  };

  const onCalMinChanged = (_e: any, value: number) => {
    if (calMinTimeoutRef.current !== null) {
      clearTimeout(calMinTimeoutRef.current);
    }
    calMinTimeoutRef.current = setTimeout(() => {
      calMinTimeoutRef.current = null;
      changeCalMin(value);
    }, 500);
  };

  const onCalMaxChanged = (_e: any, value: number) => {
    if (calMaxTimeoutRef.current !== null) {
      clearTimeout(calMaxTimeoutRef.current);
    }
    calMaxTimeoutRef.current = setTimeout(() => {
      calMaxTimeoutRef.current = null;
      changeCalMax(value);
    }, 500);
  };

  const changeCalMin = (value: number) => {
    const nextState = produce(visualState, (draft) => {
      draft.globalMeshOverlaySettings.cal_min = value;
    });
    onVisualStateChange(nextState);
  };

  const changeCalMax = (value: number) => {
    const nextState = produce(visualState, (draft) => {
      draft.globalMeshOverlaySettings.cal_max = value;
    });
    onVisualStateChange(nextState);
  };

  const onNavSelect = (_event: any, result: { itemId: string | number }) => {
    const selection: NavSelection = JSON.parse(result.itemId as string);
    if (selection.action == NavSelectionClass.Mesh) {
      changeVisibleLayer(selection.centerName);
    } else if (selection.action == NavSelectionClass.MeshOverlay) {
      changeMeshOverlay(selection.centerName);
    } else {
      console.warn(
        `unreachable: ${selection.action} is not a valid NavSelectionClass`,
      );
    }
  };

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
          {selectedSubject ? (
            <ToolbarItem>
              <Popover
                headerContent={<div>{selectedSubject.name}</div>}
                maxWidth="40rem"
                bodyContent={
                  // @ts-ignore
                  <Table variant="compact" borders={true}>
                    {/* @ts-ignore */}
                    <Tbody>
                      {Object.entries(selectedSubject.info).map(
                        ([key, value]) => (
                          // @ts-ignore
                          <Tr key={key}>
                            {/* @ts-ignore */}
                            <Td>{key}</Td>
                            {/* @ts-ignore */}
                            <Td>
                              <code>{value as string}</code>
                            </Td>
                          </Tr>
                        ),
                      )}
                    </Tbody>
                  </Table>
                }
              >
                <Button variant="secondary">Subject Info</Button>
              </Popover>
            </ToolbarItem>
          ) : undefined}

          {subjects ? (
            <ToolbarItem>
              <SubjectDropdown
                subjects={subjects}
                selectedSubject={selectedSubject}
                onSubjectSelect={onSubjectSelect}
              />
            </ToolbarItem>
          ) : undefined}
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
      <PageSidebarBody>
        <Nav onSelect={onNavSelect}>
          <NavGroup title="Layer">
            {leftSurfaces.map((mesh) => (
              <NavItem
                preventDefault
                itemId={JSON.stringify({
                  action: NavSelectionClass.Mesh,
                  centerName: mesh.centerName,
                })}
                isActive={mesh.visible}
              >
                {mesh.centerName}
              </NavItem>
            ))}
          </NavGroup>
          <NavGroup title="Overlay Selection">
            {leftSurfaces[0]
              ? leftSurfaces[0].layerUrls.map((layerUrl) => (
                  <NavItem
                    preventDefault
                    itemId={JSON.stringify({
                      action: NavSelectionClass.MeshOverlay,
                      centerName: centerNameOf(layerUrl),
                    })}
                    isActive={leftSurfaces[0].activeLayerUrl === layerUrl}
                  >
                    {centerNameOf(layerUrl)}
                  </NavItem>
                ))
              : undefined}
          </NavGroup>
        </Nav>
      </PageSidebarBody>
      <PageSidebarBody>
        {/* @ts-ignore */}
        <Panel>
          <PanelHeader>Overlay Settings</PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <Text component={TextVariants.h3}>cal_min</Text>
              <Slider
                min={0}
                max={visualState.globalMeshOverlaySettings.cal_max}
                onChange={onCalMinChanged}
                value={visualState.globalMeshOverlaySettings.cal_min}
              ></Slider>

              <Text component={TextVariants.h3}>cal_max</Text>
              <Slider
                min={visualState.globalMeshOverlaySettings.cal_min}
                max={20}
                onChange={onCalMaxChanged}
                value={visualState.globalMeshOverlaySettings.cal_max}
              ></Slider>
            </PanelMainBody>
          </PanelMain>
        </Panel>
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
  // TODO test me
  return produce(visualState, (draft) => {
    draft.meshes = visualState.meshes.map((mesh) =>
      mesh.changeVisible(centerName === mesh.centerName),
    );
    draft.volumes = visualState.volumes.map((vol) =>
      vol.changeOpacity(centerName === vol.centerName ? 1.0 : 0.0),
    );
  });
}

/**
 * Changes which mesh overlays are visible, based on which ones match the given `centerName`.
 */
function changeMeshOverlayState(
  visualState: VisualState,
  centerName: string,
): VisualState {
  // TODO test me
  return produce(visualState, (draft) => {
    draft.meshes = visualState.meshes.map((mesh) => {
      const i = mesh.layerUrls.findIndex(
        (layerUrl) => centerNameOf(layerUrl) === centerName,
      );
      return i === -1 ? mesh : mesh.changeActiveLayer(i);
    });
  });
}

export default MyPage;

export { changeVisibleLayerState, changeMeshOverlayState };

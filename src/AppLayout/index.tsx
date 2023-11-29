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
 * A value which (hopefully) will never appear in a file name.
 */
const CENTERNAME_NEVER = "d801cf74-e90e-4a4e-8891-0a778fa94324";

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
        isScrollable
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
  const firstVisibleLeftSurface =
    leftSurfaces.find((mesh) => mesh.visible) || null;

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
          {/* Show a popover which contains a table of the subject's metadata, which comes from the CSV file. */}
          {selectedSubject && selectedSubject.info ? (
            <ToolbarItem>
              <Popover
                headerContent={<div>{selectedSubject.name}</div>}
                maxWidth="40rem"
                bodyContent={createTable(selectedSubject.info)}
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
          ? "Niivue Brain Surface Browser"
          : import.meta.env.PREACT_APP_NAME}
      </MastheadMain>
      <MastheadContent>{headerToolbar}</MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav onSelect={onNavSelect}>
          {/* Brain layer selection, e.g. white matter, gray matter, cortical plate, subplate, ... */}
          <NavGroup title="Brain Layer">
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
          {/* Overlay selection e.g. cortical thickness, curvature, sulcal depth, ... */}
          <NavGroup title="Overlay Selection">
            {firstVisibleLeftSurface
              ? firstVisibleLeftSurface.layerUrls.map((layerUrl) => (
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
          {/* Overlay settings e.g. min and max values */}
          <PanelHeader>Overlay Settings</PanelHeader>
          <Divider />
          <PanelMain>
            <PanelMainBody>
              <Text component={TextVariants.h3}>cal_min</Text>
              <Slider
                min={-20}
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

              <div style={{ height: "1em" }}></div>
              <Button
                variant="secondary"
                onClick={() => changeMeshOverlay(CENTERNAME_NEVER)}
              >
                Clear mesh overlay
              </Button>
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
      return mesh.changeActiveLayer(i === -1 ? null : i);
    });
  });
}

function createTable(data: any) {
  return (
    // @ts-ignore
    <Table variant="compact" borders={true}>
      {/* @ts-ignore */}
      <Tbody>
        {Object.entries(data).map(([key, value]) => (
          // @ts-ignore
          <Tr key={key}>
            {/* @ts-ignore */}
            <Td>{key}</Td>
            {/* @ts-ignore */}
            <Td>
              <code>{value as string}</code>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}

export default MyPage;

export { changeVisibleLayerState, changeMeshOverlayState };

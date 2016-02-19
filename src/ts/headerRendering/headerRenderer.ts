import _ from '../utils';
import HeaderTemplateLoader from "./headerTemplateLoader";
import GridOptionsWrapper from "../gridOptionsWrapper";
import {ColumnController} from "../columnController/columnController";
import {Grid} from "../grid";
import FilterManager from "../filter/filterManager";
import GridPanel from "../gridPanel/gridPanel";
import {ColumnGroupChild} from "../entities/columnGroupChild";
import ColumnGroup from "../entities/columnGroup";
import RenderedHeaderGroupCell from "./renderedHeaderGroupCell";
import Column from "../entities/column";
import RenderedHeaderCell from "./renderedHeaderCell";
import {DragService} from "./dragService";
import {Bean} from "../context/context";
import {Qualifier} from "../context/context";
import {GridCore} from "../gridCore";
import {IMenuFactory} from "../interfaces/iMenuFactory";
import PopupService from "../widgets/agPopupService";
import {Autowired} from "../context/context";
import {Context} from "../context/context";
import {IRenderedHeaderElement} from "./iRenderedHeaderElement";
import {HeaderContainer} from "./headerContainer";
import EventService from "../eventService";
import {Events} from "../events";
import ColumnChangeEvent from "../columnChangeEvent";

@Bean('headerRenderer')
export default class HeaderRenderer {

    @Autowired('headerTemplateLoader') private headerTemplateLoader: HeaderTemplateLoader;
    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired('columnController') private columnController: ColumnController;
    @Autowired('filterManager') private filterManager: FilterManager;
    @Autowired('$scope') private $scope: any;
    @Autowired('$compile') private $compile: any;
    @Autowired('dragService') private dragService: DragService;
    @Autowired('gridPanel') private gridPanel: GridPanel;
    @Autowired('menuFactory') private menuFactory: IMenuFactory;
    @Autowired('popupService') private popupService: PopupService;
    @Autowired('context') private context: Context;
    @Autowired('eventService') private eventService: EventService;

    private pinnedLeftContainer: HeaderContainer;
    private pinnedRightContainer: HeaderContainer;
    private centerContainer: HeaderContainer;

    private eHeaderViewport: HTMLElement;
    private eRoot: HTMLElement;
    private eHeaderOverlay: HTMLElement;

    private agPostWire() {
        this.eHeaderViewport = this.gridPanel.getHeaderViewport();
        this.eRoot = this.gridPanel.getRoot();
        this.eHeaderOverlay = this.gridPanel.getHeaderOverlay();

        this.pinnedLeftContainer = new HeaderContainer(this.gridPanel.getPinnedLeftHeader(), null, this.eRoot, Column.PINNED_LEFT);
        this.pinnedRightContainer = new HeaderContainer(this.gridPanel.getPinnedRightHeader(), null, this.eRoot, Column.PINNED_RIGHT);
        this.centerContainer = new HeaderContainer(this.gridPanel.getHeaderContainer(), this.gridPanel.getHeaderViewport(), this.eRoot, null);

        this.context.wireBean(this.pinnedLeftContainer);
        this.context.wireBean(this.pinnedRightContainer);
        this.context.wireBean(this.centerContainer);

        // unlike the table data, the header more often 'refreshes everything' as a way to redraw, rather than
        // do delta changes based on the event. this is because groups have bigger impacts, eg a column move
        // can end up in a group splitting into two, or joining into one. this complexity makes the job much
        // harder to do delta updates. instead we just shotgun - which is fine, as the header is relatively
        // small compared to the body, so the cpu cost is low in comparison. it does mean we don't get any
        // animations.

        this.eventService.addEventListener(Events.EVENT_COLUMN_EVERYTHING_CHANGED, this.refreshHeader.bind(this));
        this.eventService.addEventListener(Events.EVENT_COLUMN_ROW_GROUP_CHANGE, this.refreshHeader.bind(this));
        this.eventService.addEventListener(Events.EVENT_COLUMN_MOVED, this.refreshHeader.bind(this));
        this.eventService.addEventListener(Events.EVENT_COLUMN_VISIBLE, this.refreshHeader.bind(this));
        this.eventService.addEventListener(Events.EVENT_COLUMN_GROUP_OPENED, this.refreshHeader.bind(this));
        this.eventService.addEventListener(Events.EVENT_COLUMN_PINNED, this.refreshHeader.bind(this));

        // for resized, the individual cells take care of this, so don't need to refresh everything
        this.eventService.addEventListener(Events.EVENT_COLUMN_RESIZED, this.setPinnedColContainerWidth.bind(this));
    }

    // this is called from the API and refreshes everything, should be broken out
    // into refresh everything vs just something changed
    public refreshHeader() {
        this.pinnedLeftContainer.removeAllChildren();
        this.pinnedRightContainer.removeAllChildren();
        this.centerContainer.removeAllChildren();

        this.pinnedLeftContainer.insertHeaderRowsIntoContainer();
        this.pinnedRightContainer.insertHeaderRowsIntoContainer();
        this.centerContainer.insertHeaderRowsIntoContainer();

        // if forPrint, overlay is missing
        var rowHeight = this.gridOptionsWrapper.getHeaderHeight();

        // we can probably get rid of this when we no longer need the overlay
        var dept = this.columnController.getColumnDept();
        if (this.eHeaderOverlay) {
            this.eHeaderOverlay.style.height = rowHeight + 'px';
            this.eHeaderOverlay.style.top = ((dept-1) * rowHeight) + 'px';
        }

        this.updateFilterIcons();
        this.updateSortIcons();
        this.setPinnedColContainerWidth();
    }

    public setPinnedColContainerWidth() {
        if (this.gridOptionsWrapper.isForPrint()) {
            // pinned col doesn't exist when doing forPrint
            return;
        }

        var pinnedLeftWidth = this.columnController.getPinnedLeftContainerWidth() + 'px';
        this.eHeaderViewport.style.marginLeft = pinnedLeftWidth;

        var pinnedRightWidth = this.columnController.getPinnedRightContainerWidth() + 'px';
        this.eHeaderViewport.style.marginRight = pinnedRightWidth;
    }

    public updateSortIcons() {
        this.pinnedLeftContainer.updateSortIcons();
        this.pinnedRightContainer.updateSortIcons();
        this.centerContainer.updateSortIcons();
    }

    public updateFilterIcons() {
        this.pinnedLeftContainer.updateFilterIcons();
        this.pinnedRightContainer.updateFilterIcons();
        this.centerContainer.updateFilterIcons();
    }

    public onIndividualColumnResized(column: Column): void {
        this.pinnedLeftContainer.onIndividualColumnResized(column);
        this.pinnedRightContainer.onIndividualColumnResized(column);
        this.centerContainer.onIndividualColumnResized(column);
    }
}

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from auth.router import get_current_user
from .influx import InfluxWrapper
import pandas as pd
import io
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional, List

router = APIRouter(prefix="/export", tags=["export"])
influx = InfluxWrapper()

@router.get("/csv")
def export_csv(
    minutes: int = 60, 
    measurement: str = "realtime_drilling",
    current_user = Depends(get_current_user)
):
    """
    Exports data for the last X minutes as CSV.
    """
    try:
        query = f'''
        from(bucket: "{influx.bucket}")
          |> range(start: -{minutes}m)
          |> filter(fn: (r) => r["_measurement"] == "{measurement}")
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        
        tables = influx.query_api.query_data_frame(query=query)
        
        if isinstance(tables, list):
             df = pd.concat(tables)
        else:
             df = tables
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found for this period")

        if '_start' in df.columns: df.drop(columns=['_start', '_stop', 'result', 'table'], inplace=True, errors='ignore')
        
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=export_{measurement}.csv"
        return response

    except Exception as e:
        print(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _build_xlsx_bytes(headers, rows):
    """Build a minimal XLSX file using only Python stdlib (zipfile + XML).
    XLSX is an Open XML format: a ZIP containing XML parts."""

    # ── shared strings ──
    shared = []
    ss_map = {}
    def si(text):
        text = str(text)
        if text not in ss_map:
            ss_map[text] = len(shared)
            shared.append(text)
        return ss_map[text]

    # Register headers
    for h in headers:
        si(h)

    # Build sheet rows
    sheet_rows = []
    # Header row
    cells = []
    for ci, h in enumerate(headers):
        col_letter = _col_letter(ci)
        cells.append(f'<c r="{col_letter}1" t="s"><v>{si(h)}</v></c>')
    sheet_rows.append(f'<row r="1">{"".join(cells)}</row>')

    # Data rows
    for ri, row in enumerate(rows, start=2):
        cells = []
        for ci, val in enumerate(row):
            col_letter = _col_letter(ci)
            ref = f"{col_letter}{ri}"
            if val is None or (isinstance(val, float) and pd.isna(val)):
                cells.append(f'<c r="{ref}"><v></v></c>')
            elif isinstance(val, (int, float)):
                cells.append(f'<c r="{ref}"><v>{val}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="s"><v>{si(str(val))}</v></c>')
        sheet_rows.append(f'<row r="{ri}">{"".join(cells)}</row>')

    # ── XML Parts ──
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Trend Data" sheetId="1" r:id="rId1"/></sheets>
</workbook>'''

    # Styles with header formatting
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF004B8D"/></patternFill></fill>
  </fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="2">
    <xf fontId="0" fillId="0" borderId="0"/>
    <xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>'''

    # Apply style to header row
    styled_header_cells = []
    for ci, h in enumerate(headers):
        col_letter = _col_letter(ci)
        styled_header_cells.append(f'<c r="{col_letter}1" t="s" s="1"><v>{si(h)}</v></c>')
    sheet_rows[0] = f'<row r="1">{"".join(styled_header_cells)}</row>'

    # Column widths
    col_widths = []
    for ci, h in enumerate(headers):
        w = max(len(str(h)) + 4, 12)
        col_widths.append(f'<col min="{ci+1}" max="{ci+1}" width="{w}" customWidth="1"/>')

    last_col = _col_letter(len(headers) - 1)
    last_row = len(rows) + 1
    dimension = f'<dimension ref="A1:{last_col}{last_row}"/>'

    sheet = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  {dimension}
  <cols>{"".join(col_widths)}</cols>
  <sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetData>{"".join(sheet_rows)}</sheetData>
</worksheet>'''

    # Shared strings
    ss_items = "".join(f'<si><t>{_xml_escape(s)}</t></si>' for s in shared)
    shared_strings = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(shared)}" uniqueCount="{len(shared)}">
{ss_items}
</sst>'''

    # Write ZIP
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', content_types)
        zf.writestr('_rels/.rels', rels)
        zf.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        zf.writestr('xl/workbook.xml', workbook)
        zf.writestr('xl/styles.xml', styles)
        zf.writestr('xl/sharedStrings.xml', shared_strings)
        zf.writestr('xl/worksheets/sheet1.xml', sheet)
    buf.seek(0)
    return buf


def _col_letter(idx):
    """Convert 0-based column index to Excel column letter (A, B, ..., Z, AA, AB, ...)."""
    result = ""
    while True:
        result = chr(65 + idx % 26) + result
        idx = idx // 26 - 1
        if idx < 0:
            break
    return result


def _xml_escape(s):
    """Escape XML special characters."""
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


@router.get("/excel")
def export_excel(
    start_date: str = Query(..., description="Start date in ISO format, e.g. 2026-01-01T00:00:00Z"),
    end_date: str = Query(..., description="End date in ISO format, e.g. 2026-07-01T00:00:00Z"),
    measurement: str = "realtime_drilling",
    fields: Optional[str] = Query(None, description="Comma-separated list of field names to include"),
    current_user = Depends(get_current_user)
):
    """
    Exports data between two dates as an Excel (.xlsx) file.
    Uses pure Python stdlib — no openpyxl needed.
    """
    try:
        field_list = [f.strip() for f in fields.split(",")] if fields else None

        field_filter = ""
        if field_list:
            field_clauses = " or ".join([f'r._field == "{f}"' for f in field_list])
            field_filter = f'|> filter(fn: (r) => {field_clauses})'

        query = f'''
        from(bucket: "{influx.bucket}")
          |> range(start: {start_date}, stop: {end_date})
          |> filter(fn: (r) => r["_measurement"] == "{measurement}")
          {field_filter}
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
          |> sort(columns: ["_time"], desc: false)
        '''

        tables = influx.query_api.query_data_frame(query=query)

        if isinstance(tables, list):
            df = pd.concat(tables, ignore_index=True)
        else:
            df = tables

        if df.empty:
            raise HTTPException(status_code=404, detail="No data found for this period")

        # Cleanup internal InfluxDB columns
        drop_cols = ['_start', '_stop', 'result', 'table', '_measurement']
        df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True, errors='ignore')

        # Rename _time to Time
        if '_time' in df.columns:
            df.rename(columns={'_time': 'Time'}, inplace=True)

        headers = list(df.columns)
        rows = df.values.tolist()

        output = _build_xlsx_bytes(headers, rows)

        response = StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = f"attachment; filename=trend_export_{measurement}.xlsx"
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"Excel Export Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

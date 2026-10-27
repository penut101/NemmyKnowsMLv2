import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
DATA = Path(os.getenv('NBA_DATA_DIR', str(ROOT / 'data'))).resolve()
DATA.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv('NBA_DATABASE_URL', 'sqlite:///' + (DATA / 'nba.sqlite').as_posix())
PINS = {
    'nba_data': ('shufinskiy/nba_data', 'e829d4678be1e075f99e5d41a1c5f97089be446b'),
    'nbainjuries': ('mxufc29/nbainjuries', '57603738fb28185e3c1bf4d71d75af0f85514ac1'),
    'sbr': ('kyleskom/NBA-Machine-Learning-Sports-Betting', '8e36b0b72ecc5082aa8976dff742cdf910b3aa36'),
}

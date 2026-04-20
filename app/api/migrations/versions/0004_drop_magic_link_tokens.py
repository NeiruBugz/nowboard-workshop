"""drop magic link tokens

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('magic_link_tokens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_magic_link_tokens_email'))
        batch_op.drop_index(batch_op.f('ix_magic_link_tokens_token'))
    op.drop_table('magic_link_tokens')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        'magic_link_tokens',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('token', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('email', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('magic_link_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_magic_link_tokens_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_magic_link_tokens_token'), ['token'], unique=True)

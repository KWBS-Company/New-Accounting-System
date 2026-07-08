# import os
# from dotenv import load_dotenv
# from sqlalchemy import create_engine, text
# from sqlalchemy.orm import sessionmaker

# # Load environment variables from the backend's .env.local file
# dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', '.env.local')
# load_dotenv(dotenv_path)

# # Database connection parameters
# DB_HOST = os.getenv("DB_HOST", "localhost")
# DB_PORT = os.getenv("DB_PORT", "5432")
# DB_USERNAME = os.getenv("DB_USERNAME", "")
# DB_PASSWORD = os.getenv("DB_PASSWORD", "")
# DB_DATABASE = os.getenv("DB_DATABASE", "")

# # Construct the database URL for SQLAlchemy (using psycopg2)
# DATABASE_URL = f"postgresql+psycopg2://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_DATABASE}"

# # Create the SQLAlchemy engine
# engine = create_engine(DATABASE_URL, echo=False)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# def get_account_balance(account_id: int):
#     """
#     Get the balance of the specific account (ledger head) by its ID.
#     Returns a dictionary with the account details and balance.
#     """
#     session = SessionLocal()
#     try:
#         # First, get the account details
#         account_sql = text("""
#             SELECT id, name, code, ledger_head_type
#             FROM ledgerheads
#             WHERE id = :account_id
#         """)
#         account_result = session.execute(account_sql, {"account_id": account_id}).fetchone()
#         if not account_result:
#             return {"error": f"Account with ID {account_id} not found"}

#         account_id, account_name, account_code, account_type = account_result

#         # Then, get the total debit and credit for this account
#         balance_sql = text("""
#             SELECT
#                 COALESCE(SUM(debit), 0) AS total_debit,
#                 COALESCE(SUM(credit), 0) AS total_credit
#             FROM journallines
#             WHERE ledger_head_id = :account_id
#         """)
#         balance_result = session.execute(balance_sql, {"account_id": account_id}).fetchone()
#         total_debit = balance_result[0] if balance_result else 0
#         total_credit = balance_result[1] if balance_result else 0
#         net = float(total_debit) - float(total_credit)

#         # Determine the balance based on the account type
#         if account_type in ['ASSET', 'EXPENSE']:
#             balance = net
#             balance_type = "debit" if net >= 0 else "credit"
#         else:  # LIABILITY, EQUITY, REVENUE
#             balance = -net  # or total_credit - total_debit
#             balance_type = "credit" if (-net) >= 0 else "debit"

#         return {
#             "account_id": account_id,
#             "account_name": account_name,
#             "account_code": account_code,
#             "account_type": account_type,
#             "total_debit": float(total_debit),
#             "total_credit": float(total_credit),
#             "balance": float(balance),
#             "balance_type": balance_type
#         }
#     except Exception as e:
#         return {"error": str(e)}
#     finally:
#         session.close()


# def list_transactions(start_date: str, end_date: str):
#     """
#     List transactions within a date range (inclusive).
#     Expects dates in YYYY-MM-DD format.
#     Returns a dictionary with the list of transactions and counts.
#     """
#     session = SessionLocal()
#     try:
#         # Validate date format
#         from datetime import datetime
#         try:
#             datetime.strptime(start_date, "%Y-%m-%d")
#             datetime.strptime(end_date, "%Y-%m-%d")
#         except ValueError:
#             return {"error": "Invalid date format. Please use YYYY-MM-DD."}

#         # Get transactions in the date range
#         transactions_sql = text("""
#             SELECT id, uuid, reference, description, transaction_date
#             FROM journaltransactions
#             WHERE transaction_date >= :start_date AND transaction_date <= :end_date
#             ORDER BY transaction_date DESC
#         """)
#         transactions_result = session.execute(transactions_sql, {
#             "start_date": start_date,
#             "end_date": end_date
#         }).fetchall()

#         transaction_list = []
#         for row in transactions_result:
#             tx_id, tx_uuid, tx_reference, tx_description, tx_date = row

#             # Get the lines for this transaction
#             lines_sql = text("""
#                 SELECT jl.ledger_head_id, jl.debit, jl.credit, jl.description,
#                        lh.name AS ledger_head_name, lh.code AS ledger_head_code
#             FROM journallines jl
#             JOIN ledgerheads lh ON jl.ledger_head_id = lh.id
#             WHERE jl.transaction_id = :tx_id
#             """)
#             lines_result = session.execute(lines_sql, {"tx_id": tx_id}).fetchall()

#             lines_info = []
#             for line in lines_result:
#                 ledger_head_id, debit, credit, description, ledger_head_name, ledger_head_code = line
#                 lines_info.append({
#                     "ledger_head_id": ledger_head_id,
#                     "ledger_head_name": ledger_head_name,
#                     "ledger_head_code": ledger_head_code,
#                     "debit": float(debit) if debit else 0.0,
#                     "credit": float(credit) if credit else 0.0,
#                     "description": description
#                 })

#             transaction_list.append({
#                 "transaction_id": str(tx_uuid),
#                 "reference": tx_reference,
#                 "description": tx_description,
#                 "transaction_date": tx_date.isoformat() if tx_date else None,
#                 "lines": lines_info
#             })

#         return {
#             "start_date": start_date,
#             "end_date": end_date,
#             "transactions": transaction_list,
#             "count": len(transaction_list)
#         }
#     except Exception as e:
#         return {"error": str(e)}
#     finally:
#         session.close()








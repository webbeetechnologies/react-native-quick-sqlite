//
//  JSIHelper.hpp
//  react-native-quick-sqlite
//
//  Created by Oscar on 13.03.22.
//

#ifndef JSIHelper_h
#define JSIHelper_h

#include <stdio.h>
#include <jsi/jsilib.h>
#include <jsi/jsi.h>
#include <vector>
#include <map>

using namespace std;
using namespace facebook;
/**
 * Enum for QuickValue to store/determine correct type for dynamic JSI values
 */
enum QuickDataType
{
  NULL_VALUE,
  TEXT,
  INTEGER,
  INT64,
  DOUBLE,
  BOOLEAN,
  ARRAY_BUFFER,
};

/**
 * Wrapper struct to allocate dynamic JSI values to static C++ primitives
 */
struct QuickValue
{
  QuickDataType dataType;
  int booleanValue;
  double doubleOrIntValue;
  long long int64Value;
  string textValue;
  shared_ptr<uint8_t> arrayBufferValue;
  size_t arrayBufferSize;
};

/**
 * Helper struct to carry SQLite results between entities
 */
struct QuickColumnValue
{
  QuickValue value;
  string columnName;
};

/**
 * Various structs to help with the results of the SQLite operations
 */
enum ResultType
{
  SQLiteOk,
  SQLiteError
};

struct SQLiteOPResult
{
  ResultType type;
  string errorMessage;
  int rowsAffected;
  double insertId;
};

struct SQLiteFunctionResult
{
  ResultType type;
  string errorMessage;
};
struct SequelLiteralUpdateResult
{
  ResultType type;
  string message;
  int affectedRows;
};

struct SequelBatchOperationResult
{
  ResultType type;
  string message;
  int affectedRows;
  int commands;
};

/**
 * Describe column information of a resultset
 */
struct QuickColumnMetadata
{
  string colunmName;
  int columnIndex;
  string columnDeclaredType;
};

/**
 * Fill the target vector with parsed parameters
 * */
void jsiQueryArgumentsToSequelParam(jsi::Runtime &rt, jsi::Value const &args, vector<QuickValue> *target);

QuickValue createNullQuickValue();
QuickValue createBooleanQuickValue(bool value);
QuickValue createTextQuickValue(string value);
QuickValue createIntegerQuickValue(int value);
QuickValue createIntegerQuickValue(double value);
QuickValue createInt64QuickValue(long long value);
QuickValue createDoubleQuickValue(double value);
QuickValue createArrayBufferQuickValue(uint8_t *arrayBufferValue, size_t arrayBufferSize);
jsi::Value createSequelQueryExecutionResult(jsi::Runtime &rt, SQLiteOPResult status, vector<map<string, QuickValue>> *results, vector<QuickColumnMetadata> *metadata);
int createSQLiteFunctionOptions(bool DETERMINISTIC, bool DIRECTONLY, bool INNOCUOUS, bool SUBTYPE);
template<typename T>
T* clone(const T* source);
bool isEmpty(jsi::Runtime& rt, const jsi::Value* v);
bool isFunction(jsi::Runtime& rt, const jsi::Value* v);
jsi::Function getFunction(jsi::Runtime& rt, const jsi::Value* v);
jsi::Array getArgsToArray (jsi::Runtime& rt, jsi::Value* v, size_t count);

#endif /* JSIHelper_h */
